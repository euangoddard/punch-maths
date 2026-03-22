import { useCallback, useEffect, useRef, useState } from "preact/hooks";
import { gameConfig, gameResults, screen } from "../App";
import {
  playBeep,
  playCorrect,
  playPunch,
  playRoundComplete,
  playWrong,
} from "../audio/sounds";
import { HandOverlay } from "../detection/handOverlay";
import { generateQuestion } from "../engine/questions";
import type {
  Feedback,
  GameResult,
  Quadrant,
  Question,
  Streak,
} from "../types";

const QUADRANT_KEYS: Record<string, Quadrant | undefined> = {
  q: "top-left",
  e: "top-right",
  z: "bottom-left",
  c: "bottom-right",
};

const QUADRANT_POSITIONS = [
  {
    id: "top-left" as Quadrant,
    gridClass: "col-start-1 row-start-1",
    alignClass: "items-start justify-start",
    border: "border-r border-b",
    key: "Q",
    targetPos: "top-8 left-8",
    extraTopPad: true,
  },
  {
    id: "top-right" as Quadrant,
    gridClass: "col-start-2 row-start-1",
    alignClass: "items-start justify-end",
    border: "border-b",
    key: "E",
    targetPos: "top-8 right-8",
    extraTopPad: true,
  },
  {
    id: "bottom-left" as Quadrant,
    gridClass: "col-start-1 row-start-2",
    alignClass: "items-end justify-start",
    border: "border-r",
    key: "Z",
    targetPos: "bottom-8 left-8",
    extraTopPad: false,
  },
  {
    id: "bottom-right" as Quadrant,
    gridClass: "col-start-2 row-start-2",
    alignClass: "items-end justify-end",
    border: "",
    key: "C",
    targetPos: "bottom-8 right-8",
    extraTopPad: false,
  },
];

const CLASSIC_TOTAL = 10;
const QUESTION_SECS = 5;
const FEEDBACK_MS = 1400;

type GamePhase = "loading" | "countdown" | "question" | "feedback" | "end";

export default function GameScreen() {
  const config = gameConfig.value;
  const isTimeAttack = config.mode === "time-attack";

  const videoRef = useRef<HTMLVideoElement>(null);
  const overlayCanvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const handOverlayRef = useRef<HandOverlay | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const questionStartRef = useRef(0);
  const gameStartedRef = useRef(false);

  const [phase, setPhase] = useState<GamePhase>("loading");
  const [currentQ, setCurrentQ] = useState<Question | null>(null);
  const [questionIndex, setQuestionIndex] = useState(0);
  const [score, setScore] = useState(0);
  const [timeLeft, setTimeLeft] = useState(
    isTimeAttack ? config.duration : QUESTION_SECS,
  );
  const [results, setResults] = useState<GameResult[]>([]);
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const [streak, setStreak] = useState<Streak>({ current: 0, best: 0 });
  const [cameraActive, setCameraActive] = useState(false);
  const [streakToast, setStreakToast] = useState<string | null>(null);
  const [countdownVal, setCountdownVal] = useState(3);

  // Stable refs to latest state (avoids stale closures in callbacks/setIntervals)
  const phaseRef = useRef(phase);
  const currentQRef = useRef(currentQ);
  const questionIndexRef = useRef(questionIndex);
  const scoreRef = useRef(score);
  const timeLeftRef = useRef(timeLeft);
  const resultsRef = useRef(results);
  const streakRef = useRef(streak);

  phaseRef.current = phase;
  currentQRef.current = currentQ;
  questionIndexRef.current = questionIndex;
  scoreRef.current = score;
  timeLeftRef.current = timeLeft;
  resultsRef.current = results;
  streakRef.current = streak;

  // ── Camera + detector init ───────────────────────────────────────────────
  useEffect(() => {
    async function init() {
      if (!config.keyboardOnly) {
        try {
          const stream = await navigator.mediaDevices.getUserMedia({
            video: {
              facingMode: "user",
              width: { ideal: 640 },
              height: { ideal: 480 },
            },
          });
          streamRef.current = stream;
          const vid = videoRef.current;
          if (vid) {
            vid.srcObject = stream;
            await vid.play();
            setCameraActive(true);

            const overlayCanvas = overlayCanvasRef.current;
            if (overlayCanvas) {
              const overlay = new HandOverlay(vid, overlayCanvas, {
                onPunch: handlePunch,
              });
              handOverlayRef.current = overlay;
              await overlay.init();
              overlay.start();
            }
          }
        } catch {
          // Camera unavailable — proceed keyboard-only
        }
      }

      // 3-2-1 countdown: camera/detector already running so baseline warms up
      await new Promise<void>((resolve) => {
        let c = 3;
        setPhase("countdown");
        setCountdownVal(c);
        playBeep(false);
        const id = setInterval(() => {
          c -= 1;
          if (c > 0) {
            setCountdownVal(c);
            playBeep(c === 1);
          } else {
            setCountdownVal(0);
            clearInterval(id);
            setTimeout(resolve, 500);
          }
        }, 1000);
      });

      beginGame();
    }

    init();

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
      handOverlayRef.current?.stop();
      streamRef.current?.getTracks().forEach((t) => {
        t.stop();
      });
    };
  }, []);

  // ── Keyboard controls ────────────────────────────────────────────────────
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const q = QUADRANT_KEYS[e.key.toLowerCase()];
      if (q && phaseRef.current === "question") {
        handlePunch(q);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // ── Classic: per-question countdown (re-arms on each new question) ───────
  useEffect(() => {
    if (isTimeAttack || phase !== "question") {
      return;
    }
    if (timerRef.current) {
      clearInterval(timerRef.current);
    }

    let t = QUESTION_SECS;
    setTimeLeft(t);

    timerRef.current = setInterval(() => {
      t -= 1;
      setTimeLeft(t);
      if (t <= 3 && t > 0) {
        playBeep(t === 1);
      }
      if (t <= 0) {
        if (timerRef.current) {
          clearInterval(timerRef.current);
        }
        if (phaseRef.current === "question") {
          handleTimeout();
        }
      }
    }, 1000);

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, [phase, questionIndex]);

  // ── Time Attack: single global countdown (starts when game begins) ───────
  useEffect(() => {
    if (!isTimeAttack || phase === "loading" || phase === "countdown") {
      return;
    }
    if (gameStartedRef.current) {
      return;
    }
    gameStartedRef.current = true;
    if (timerRef.current) {
      clearInterval(timerRef.current);
    }

    const t = config.duration;
    setTimeLeft(t);

    timerRef.current = setInterval(() => {
      // Use the ref as source of truth so time-bonus/penalty adjustments are respected.
      const t = timeLeftRef.current - 1;
      setTimeLeft(t);
      timeLeftRef.current = t;
      if (t <= 10 && t > 0) {
        playBeep(t <= 3);
      }
      if (t <= 0) {
        if (timerRef.current) {
          clearInterval(timerRef.current);
        }
        if (phaseRef.current !== "end") {
          endGame();
        }
      }
    }, 1000);
  }, [phase]);

  // ── Game flow ─────────────────────────────────────────────────────────────
  function beginGame() {
    loadQuestion(0);
  }

  function loadQuestion(_idx: number) {
    const q = generateQuestion(config.difficulty);
    setCurrentQ(q);
    setPhase("question");
    setFeedback(null);
    questionStartRef.current = Date.now();
  }

  function handleTimeout() {
    const q = currentQRef.current;
    if (!q) {
      return;
    }
    const correctQ = q.options.find((o) => o.isCorrect)?.quadrant;
    processAnswer(null, correctQ, false, 0);
  }

  const handlePunch = useCallback((quadrant: Quadrant) => {
    if (phaseRef.current !== "question") {
      return;
    }
    const q = currentQRef.current;
    if (!q) {
      return;
    }

    playPunch();
    // Classic only: stop the per-question timer on punch.
    // Time Attack: the global countdown must keep running.
    if (!isTimeAttack && timerRef.current) {
      clearInterval(timerRef.current);
    }

    const reactionMs = Date.now() - questionStartRef.current;
    const chosen = q.options.find((o) => o.quadrant === quadrant);
    const correct = chosen?.isCorrect ?? false;
    const correctQ = q.options.find((o) => o.isCorrect)?.quadrant;

    processAnswer(quadrant, correctQ, correct, reactionMs);
  }, []);

  function processAnswer(
    chosenQ: Quadrant | null,
    correctQ: Quadrant | undefined,
    correct: boolean,
    reactionMs: number,
  ) {
    if (correct) {
      playCorrect();
    } else {
      playWrong();
    }

    const newScore = scoreRef.current + (correct ? 1 : 0);
    const prev = streakRef.current;
    const newStreak: Streak = correct
      ? {
          current: prev.current + 1,
          best: Math.max(prev.best, prev.current + 1),
        }
      : { current: 0, best: prev.best };

    // Time Attack: adjust total time (update ref so the interval picks it up)
    if (isTimeAttack) {
      const adjusted = Math.max(0, timeLeftRef.current + (correct ? 2 : -1));
      timeLeftRef.current = adjusted;
      setTimeLeft(adjusted);
    }

    setScore(newScore);
    setStreak(newStreak);
    setFeedback({ chosenQ, correctQ, correct });
    setPhase("feedback");

    const q = currentQRef.current;
    if (!q) {
      return;
    }
    const newResult: GameResult = {
      question: q.text,
      answer: q.answer,
      chosenQ,
      correctQ,
      correct,
      reactionMs,
    };
    const newResults = [...resultsRef.current, newResult];
    setResults(newResults);

    if (correct && newStreak.current >= 3 && newStreak.current % 3 === 0) {
      setStreakToast(`🔥 ${newStreak.current} in a row!`);
      setTimeout(() => setStreakToast(null), 1600);
    }

    setTimeout(() => {
      const nextIdx = questionIndexRef.current + 1;
      if (!isTimeAttack && nextIdx >= CLASSIC_TOTAL) {
        endGame(newResults, newScore, newStreak);
        return;
      }
      setQuestionIndex(nextIdx);
      loadQuestion(nextIdx);
    }, FEEDBACK_MS);
  }

  function endGame(
    finalResults?: GameResult[],
    finalScore?: number,
    finalStreak?: Streak,
  ) {
    if (timerRef.current) {
      clearInterval(timerRef.current);
    }
    setPhase("end");

    const res = finalResults ?? resultsRef.current;
    const sc = finalScore ?? scoreRef.current;
    const st = finalStreak ?? streakRef.current;
    const answered = res.filter((r) => r.reactionMs > 0);
    const avgReactionMs = answered.length
      ? Math.round(
          answered.reduce((s, r) => s + r.reactionMs, 0) / answered.length,
        )
      : 0;

    playRoundComplete();

    gameResults.value = {
      score: sc,
      total: res.length,
      accuracy: res.length > 0 ? Math.round((sc / res.length) * 100) : 0,
      avgReactionMs,
      bestStreak: st.best,
      results: res,
      mode: config.mode,
      difficulty: config.difficulty,
    };

    setTimeout(() => {
      screen.value = "summary";
    }, 500);
  }

  // ── Render ────────────────────────────────────────────────────────────────
  const timerPercent = Math.max(
    0,
    isTimeAttack
      ? (timeLeft / config.duration) * 100
      : (timeLeft / QUESTION_SECS) * 100,
  );
  const timerUrgent = timeLeft <= 3;
  const timerWarn = timeLeft <= (isTimeAttack ? 10 : 3);

  return (
    <div class="h-screen w-screen relative overflow-hidden bg-black select-none touch-none">
      {/* Camera feed — always in DOM so videoRef is always valid */}
      <video
        ref={videoRef}
        class={`absolute inset-0 w-full h-full object-cover video-mirror transition-opacity duration-500 ${cameraActive ? "opacity-55" : "opacity-0"}`}
        muted
        playsInline
        autoPlay
      />

      {/* Hand landmark overlay */}
      <canvas
        ref={overlayCanvasRef}
        class="absolute inset-0 w-full h-full video-mirror pointer-events-none"
      />

      {/* Background when no camera */}
      <div
        class={`absolute inset-0 bg-indigo-950 transition-opacity ${cameraActive ? "opacity-0" : "opacity-100"}`}
      />

      {/* ── HUD — floated absolutely so the quadrant grid can be full-screen ── */}
      <div class="absolute top-0 left-0 right-0 z-10 pointer-events-none">
        <div class="flex items-center justify-between px-4 pt-3 pb-1 pointer-events-auto">
          <button
            type="button"
            onClick={() => {
              if (timerRef.current) {
                clearInterval(timerRef.current);
              }
              screen.value = "home";
            }}
            class="w-8 h-8 flex items-center justify-center rounded-full bg-black/50 text-white/60 hover:text-white text-sm font-bold transition-colors"
          >
            ✕
          </button>

          <div class="flex items-center gap-2">
            {streak.current >= 2 && (
              <span class="bg-orange-500/90 text-white text-sm font-bold px-3 py-0.5 rounded-full">
                🔥 {streak.current}
              </span>
            )}
            <span class="bg-black/60 text-white font-black text-xl px-4 py-0.5 rounded-full tabular-nums">
              {score}
            </span>
            {!isTimeAttack && (
              <span class="text-white/40 text-sm tabular-nums">
                {Math.min(questionIndex + 1, CLASSIC_TOTAL)}/{CLASSIC_TOTAL}
              </span>
            )}
          </div>
        </div>

        {/* Timer bar */}
        <div class="w-full h-1.5 bg-black/40">
          <div
            class={`h-full transition-all ease-linear ${timerUrgent ? "bg-red-500" : timerWarn ? "bg-orange-400" : "bg-yellow-400"}`}
            style={{ width: `${timerPercent}%`, transitionDuration: "1s" }}
          />
        </div>

        {/* Time Attack: big countdown */}
        {isTimeAttack && phase !== "loading" && (
          <div
            class={`text-center py-1 text-3xl font-display tabular-nums ${timerWarn ? "text-red-400" : "text-white/50"}`}
          >
            {timeLeft}s
          </div>
        )}
      </div>

      {/* ── Quadrant grid — full-screen so its centre aligns with video y=0.5 ── */}
      {currentQ ? (
        <div class="absolute inset-0 grid grid-cols-2 grid-rows-2">
          {QUADRANT_POSITIONS.map((pos) => {
            const opt = currentQ.options.find((o) => o.quadrant === pos.id);
            const isChosen = feedback?.chosenQ === pos.id;
            const isCorrectQ = feedback?.correctQ === pos.id;
            const showGreen = feedback && isCorrectQ;
            const showRed = feedback && isChosen && !feedback.correct;

            return (
              <button
                type="button"
                key={pos.id}
                class={`${pos.gridClass} ${pos.border} border-white/10 relative flex p-4 md:p-6 outline-none transition-colors duration-200
                    ${showGreen ? "bg-green-500/35" : ""}
                    ${showRed ? "bg-red-500/35" : ""}
                    ${!feedback ? "active:bg-white/10" : ""}
                  `}
                style={pos.extraTopPad ? { paddingTop: "72px" } : undefined}
                onClick={() => phase === "question" && handlePunch(pos.id)}
              >
                <div class={`${pos.alignClass} flex w-full h-full`}>
                  <div
                    class={`
                      relative px-5 py-3 md:px-7 md:py-4 rounded-2xl font-display text-4xl md:text-6xl transition-all duration-200 shadow-lg
                      ${showGreen ? "bg-green-500 text-white scale-110 shadow-green-500/40" : ""}
                      ${showRed ? "bg-red-500   text-white scale-95  shadow-red-500/40" : ""}
                      ${!showGreen && !showRed ? "bg-black/65 text-white backdrop-blur-sm" : ""}
                    `}
                  >
                    {opt?.value ?? ""}
                    {showGreen && (
                      <span class="absolute -top-2 -right-2 text-xl">✓</span>
                    )}
                    {showRed && (
                      <span class="absolute -top-2 -right-2 text-xl">✗</span>
                    )}
                  </div>
                </div>
                <span class="absolute bottom-1.5 right-2 text-white/20 text-xs font-mono">
                  {pos.key}
                </span>
              </button>
            );
          })}

          {/* Centre: question + per-question timer */}
          <div class="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div class="text-center px-2">
              <div class="inline-block bg-black/75 backdrop-blur-md rounded-2xl px-6 py-4 shadow-2xl">
                <div class="text-5xl md:text-7xl font-display text-white leading-none">
                  {currentQ.text}
                </div>
                {!isTimeAttack && phase === "question" && (
                  <div
                    class={`text-4xl font-display mt-2 tabular-nums leading-none transition-colors ${
                      timerUrgent
                        ? "text-red-400"
                        : timerWarn
                          ? "text-orange-400"
                          : "text-yellow-400"
                    }`}
                  >
                    {timeLeft}
                  </div>
                )}
              </div>

              {feedback && (
                <div
                  class={`mt-3 mx-auto px-5 py-2 rounded-xl font-bold text-base inline-block ${
                    feedback.correct
                      ? "bg-green-500 text-white"
                      : "bg-red-500 text-white"
                  }`}
                >
                  {feedback.correct
                    ? streak.current >= 3
                      ? `🔥 ${streak.current} streak!`
                      : "✓ Correct!"
                    : feedback.chosenQ
                      ? `✗ Answer: ${currentQ.answer}`
                      : `⏰ Time up! Answer: ${currentQ.answer}`}
                </div>
              )}
            </div>
          </div>
        </div>
      ) : (
        <div class="absolute inset-0 flex items-center justify-center">
          {phase === "countdown" ? (
            <div
              class={`font-display tabular-nums drop-shadow-2xl select-none transition-all duration-150 ${
                countdownVal === 0
                  ? "text-green-400 text-8xl"
                  : "text-white text-9xl"
              }`}
            >
              {countdownVal === 0 ? "GO!" : countdownVal}
            </div>
          ) : (
            <div class="flex flex-col items-center gap-4">
              <div class="w-10 h-10 border-4 border-yellow-400 border-t-transparent rounded-full animate-spin" />
              <p class="text-white/50 text-sm">Loading hand detection model…</p>
            </div>
          )}
        </div>
      )}

      {/* Streak toast */}
      {streakToast && (
        <div class="absolute top-14 left-1/2 -translate-x-1/2 z-30 bg-orange-500 text-white px-6 py-2 rounded-full font-black text-lg shadow-lg pointer-events-none animate-bounce-in">
          {streakToast}
        </div>
      )}

      {/* Keyboard hint (no camera) */}
      {!cameraActive && phase === "question" && (
        <div class="absolute bottom-3 left-1/2 -translate-x-1/2 bg-black/60 text-white/60 text-sm px-4 py-2 rounded-full pointer-events-none">
          Tap a corner · or press <span class="font-mono">Q · E · Z · C</span>
        </div>
      )}
    </div>
  );
}
