import {
  component$,
  type NoSerialize,
  noSerialize,
  useContext,
  useSignal,
  useStore,
  useVisibleTask$,
} from "@builder.io/qwik";
import type { DocumentHead } from "@builder.io/qwik-city";
import { useNavigate } from "@builder.io/qwik-city";
import {
  playBeep,
  playCorrect,
  playPunch,
  playRoundComplete,
  playWrong,
} from "../../audio/sounds";
import { GameConfigContext, GameResultsContext } from "../../context/game";
import { HandOverlay } from "../../detection/handOverlay";
import { generateQuestion } from "../../engine/questions";
import type {
  Feedback,
  GameResult,
  Quadrant,
  Question,
  Streak,
} from "../../types";

// ── Constants ──────────────────────────────────────────────────────────────

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
    extraTopPad: true,
  },
  {
    id: "top-right" as Quadrant,
    gridClass: "col-start-2 row-start-1",
    alignClass: "items-start justify-end",
    border: "border-b",
    key: "E",
    extraTopPad: true,
  },
  {
    id: "bottom-left" as Quadrant,
    gridClass: "col-start-1 row-start-2",
    alignClass: "items-end justify-start",
    border: "border-r",
    key: "Z",
    extraTopPad: false,
  },
  {
    id: "bottom-right" as Quadrant,
    gridClass: "col-start-2 row-start-2",
    alignClass: "items-end justify-end",
    border: "",
    key: "C",
    extraTopPad: false,
  },
];

const CLASSIC_TOTAL = 10;
const FEEDBACK_MS = 1400;

type GamePhase = "loading" | "countdown" | "question" | "feedback" | "end";

// ── Component ──────────────────────────────────────────────────────────────

export default component$(() => {
  const gameConfigSignal = useContext(GameConfigContext);
  const gameResultsSignal = useContext(GameResultsContext);
  const nav = useNavigate();

  // ── Reactive UI state ──────────────────────────────────────────────────
  const phase = useSignal<GamePhase>("loading");
  const currentQ = useSignal<Question | null>(null);
  const questionIndex = useSignal(0);
  const score = useSignal(0);
  const timeLeft = useSignal(0);
  const results = useSignal<GameResult[]>([]);
  const feedback = useSignal<Feedback | null>(null);
  const streak = useSignal<Streak>({ current: 0, best: 0 });
  const cameraActive = useSignal(false);
  const streakToast = useSignal<string | null>(null);
  const countdownVal = useSignal(3);

  // ── DOM element refs ───────────────────────────────────────────────────
  const videoEl = useSignal<HTMLVideoElement | undefined>();
  const canvasEl = useSignal<HTMLCanvasElement | undefined>();

  /**
   * Non-serializable browser resources are wrapped with noSerialize so Qwik
   * does not attempt to SSR-serialize them. They are always set by
   * useVisibleTask$ before the user can interact with the page.
   *
   * onPunch is stored here so that onClick$ handlers (which must be
   * serialisable QRLs) can delegate to the handler closure defined inside
   * useVisibleTask$ — where it can freely close over timers, streams, etc.
   */
  const browser = useStore<{
    stream: NoSerialize<MediaStream> | undefined;
    overlay: NoSerialize<HandOverlay> | undefined;
    onPunch: NoSerialize<(q: Quadrant) => void> | undefined;
    classicTimer: number | null;
    globalTimer: number | null;
    questionStart: number;
  }>({
    stream: undefined,
    overlay: undefined,
    onPunch: undefined,
    classicTimer: null,
    globalTimer: null,
    questionStart: 0,
  });

  // ── Single task owns all imperative game logic ─────────────────────────
  // biome-ignore lint/correctness/noQwikUseVisibleTask: game loop requires browser APIs (camera, audio, timers)
  useVisibleTask$(
    async ({ cleanup }) => {
      const config = gameConfigSignal.value;
      const isTimeAttack = config.mode === "time-attack";

      timeLeft.value = isTimeAttack ? config.duration : config.questionTimer;

      // ── Local helpers ────────────────────────────────────────────────────

      function stopTimers() {
        if (browser.classicTimer !== null) {
          clearInterval(browser.classicTimer);
          browser.classicTimer = null;
        }
        if (browser.globalTimer !== null) {
          clearInterval(browser.globalTimer);
          browser.globalTimer = null;
        }
      }

      function endGame(
        finalResults?: GameResult[],
        finalScore?: number,
        finalStreak?: Streak,
      ) {
        stopTimers();
        phase.value = "end";

        const res = finalResults ?? results.value;
        const sc = finalScore ?? score.value;
        const st = finalStreak ?? streak.value;
        const answered = res.filter((r) => r.reactionMs > 0);
        const avgReactionMs = answered.length
          ? Math.round(
              answered.reduce((s, r) => s + r.reactionMs, 0) / answered.length,
            )
          : 0;

        playRoundComplete();

        gameResultsSignal.value = {
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
          nav("/summary");
        }, 500);
      }

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

        const newScore = score.value + (correct ? 1 : 0);
        const prev = streak.value;
        const newStreak: Streak = correct
          ? {
              current: prev.current + 1,
              best: Math.max(prev.best, prev.current + 1),
            }
          : { current: 0, best: prev.best };

        // Signals always return the latest value, so no ref-mirror needed
        if (isTimeAttack) {
          timeLeft.value = Math.max(0, timeLeft.value + (correct ? 2 : -1));
        }

        score.value = newScore;
        streak.value = newStreak;
        feedback.value = { chosenQ, correctQ, correct };
        phase.value = "feedback";

        const q = currentQ.value;
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
        const newResults = [...results.value, newResult];
        results.value = newResults;

        if (correct && newStreak.current >= 3 && newStreak.current % 3 === 0) {
          streakToast.value = `🔥 ${newStreak.current} in a row!`;
          setTimeout(() => {
            streakToast.value = null;
          }, 1600);
        }

        const currentIdx = questionIndex.value;
        setTimeout(() => {
          const nextIdx = currentIdx + 1;
          if (!isTimeAttack && nextIdx >= CLASSIC_TOTAL) {
            endGame(newResults, newScore, newStreak);
            return;
          }
          questionIndex.value = nextIdx;
          loadQuestion();
        }, FEEDBACK_MS);
      }

      function handleTimeout() {
        const q = currentQ.value;
        if (!q) {
          return;
        }
        const correctQ = q.options.find((o) => o.isCorrect)?.quadrant;
        processAnswer(null, correctQ, false, 0);
      }

      function loadQuestion() {
        const q = generateQuestion(config.difficulty);
        currentQ.value = q;
        feedback.value = null;
        phase.value = "question";
        browser.questionStart = Date.now();

        if (!isTimeAttack) {
          if (browser.classicTimer !== null) {
            clearInterval(browser.classicTimer);
          }
          let t = config.questionTimer;
          timeLeft.value = t;
          browser.classicTimer = window.setInterval(() => {
            t -= 1;
            timeLeft.value = t;
            if (t <= 3 && t > 0) {
              playBeep(t === 1);
            }
            if (t <= 0) {
              if (browser.classicTimer !== null) {
                clearInterval(browser.classicTimer);
                browser.classicTimer = null;
              }
              if (phase.value === "question") {
                handleTimeout();
              }
            }
          }, 1000) as unknown as number;
        }
      }

      function handlePunch(quadrant: Quadrant) {
        if (phase.value !== "question") {
          return;
        }
        const q = currentQ.value;
        if (!q) {
          return;
        }

        playPunch();

        if (!isTimeAttack && browser.classicTimer !== null) {
          clearInterval(browser.classicTimer);
          browser.classicTimer = null;
        }

        const reactionMs = Date.now() - browser.questionStart;
        const chosen = q.options.find((o) => o.quadrant === quadrant);
        const correct = chosen?.isCorrect ?? false;
        const correctQ = q.options.find((o) => o.isCorrect)?.quadrant;

        processAnswer(quadrant, correctQ, correct, reactionMs);
      }

      // Expose handlePunch so onClick$ QRLs can delegate to it
      browser.onPunch = noSerialize(handlePunch);

      // ── Keyboard listener ──────────────────────────────────────────────
      // biome-ignore lint/correctness/useQwikValidLexicalScope: regular closure inside useVisibleTask$, not a QRL
      const onKey = (e: KeyboardEvent) => {
        const q = QUADRANT_KEYS[e.key.toLowerCase()];
        if (q) {
          handlePunch(q);
        }
      };
      window.addEventListener("keydown", onKey);

      // ── Camera + hand detector init ────────────────────────────────────
      if (!config.keyboardOnly) {
        try {
          const stream = await navigator.mediaDevices.getUserMedia({
            video: {
              facingMode: "user",
              width: { ideal: 640 },
              height: { ideal: 480 },
            },
          });
          browser.stream = noSerialize(stream);
          const vid = videoEl.value;
          if (vid) {
            vid.srcObject = stream;
            await vid.play();
            cameraActive.value = true;

            const canvas = canvasEl.value;
            if (canvas) {
              const overlay = new HandOverlay(vid, canvas, {
                onPunch: handlePunch,
              });
              browser.overlay = noSerialize(overlay);
              await overlay.init();
              overlay.start();
            }
          }
        } catch {
          // Camera unavailable — proceed keyboard-only
        }
      }

      // ── 3-2-1 countdown ───────────────────────────────────────────────
      await new Promise<void>((resolve) => {
        let c = 3;
        phase.value = "countdown";
        countdownVal.value = c;
        playBeep(false);
        const id = window.setInterval(() => {
          c -= 1;
          if (c > 0) {
            countdownVal.value = c;
            playBeep(c === 1);
          } else {
            countdownVal.value = 0;
            clearInterval(id);
            setTimeout(resolve, 500);
          }
        }, 1000);
      });

      // ── Time Attack: single global countdown ──────────────────────────
      if (isTimeAttack) {
        timeLeft.value = config.duration;
        browser.globalTimer = window.setInterval(() => {
          const t = timeLeft.value - 1;
          timeLeft.value = t;
          if (t <= 10 && t > 0) {
            playBeep(t <= 3);
          }
          if (t <= 0) {
            if (browser.globalTimer !== null) {
              clearInterval(browser.globalTimer);
              browser.globalTimer = null;
            }
            if (phase.value !== "end") {
              endGame();
            }
          }
        }, 1000) as unknown as number;
      }

      // ── First question ─────────────────────────────────────────────────
      loadQuestion();

      // ── Cleanup on unmount (also fires on route navigation away) ──────
      cleanup(() => {
        window.removeEventListener("keydown", onKey);
        stopTimers();
        browser.overlay?.stop();
        for (const t of browser.stream?.getTracks() ?? []) {
          t.stop();
        }
        browser.onPunch = undefined;
      });
    },
    { strategy: "document-ready" },
  );

  // ── Derived render values ──────────────────────────────────────────────
  const config = gameConfigSignal.value;
  const isTimeAttack = config.mode === "time-attack";
  const timerMax = isTimeAttack ? config.duration : config.questionTimer;
  const timerPercent = Math.max(0, (timeLeft.value / timerMax) * 100);
  const timerUrgent = timeLeft.value <= 3;
  const timerWarn = timeLeft.value <= (isTimeAttack ? 10 : 3);

  return (
    <div class="screen-container bg-black">
      {/* Camera feed — always in DOM so videoEl is always a valid ref */}
      <video
        ref={videoEl}
        class={[
          "overlay-fill object-cover video-mirror transition-opacity duration-500",
          cameraActive.value ? "opacity-55" : "opacity-0",
        ]}
        muted
        playsInline
        autoplay
      />

      {/* Hand landmark overlay */}
      <canvas
        ref={canvasEl}
        class="overlay-fill video-mirror pointer-events-none"
      />

      {/* Solid background shown when camera is unavailable */}
      <div
        class={[
          "overlay-fill bg-indigo-950 transition-opacity",
          cameraActive.value ? "opacity-0" : "opacity-100",
        ]}
      />

      {/* ── HUD ── */}
      <div class="absolute top-0 left-0 right-0 z-10 pointer-events-none">
        <div class="flex items-center justify-between px-4 pt-3 pb-1 pointer-events-auto">
          <button
            type="button"
            onClick$={() => {
              // Navigation unmounts the component which triggers
              // the useVisibleTask$ cleanup (stops timers/stream/overlay)
              nav("/");
            }}
            aria-label="Quit game"
            class="w-8 h-8 flex items-center justify-center rounded-full bg-black/50 text-white/60 hover:text-white text-sm font-bold transition-colors"
          >
            ✕
          </button>

          <div class="flex items-center gap-2">
            {streak.value.current >= 2 && (
              <span class="bg-orange-500/90 text-white text-sm font-bold px-3 py-0.5 rounded-full">
                🔥 {streak.value.current}
              </span>
            )}
            <span class="bg-black/60 text-white font-black text-xl px-4 py-0.5 rounded-full tabular-nums">
              {score.value}
            </span>
            {!isTimeAttack && (
              <span class="text-white/60 text-sm tabular-nums">
                {Math.min(questionIndex.value + 1, CLASSIC_TOTAL)}/
                {CLASSIC_TOTAL}
              </span>
            )}
          </div>
        </div>

        {/* Timer bar */}
        <div class="w-full h-1.5 bg-black/40">
          <div
            class={[
              "h-full transition-all ease-linear",
              timerUrgent
                ? "bg-red-500"
                : timerWarn
                  ? "bg-orange-400"
                  : "bg-yellow-400",
            ]}
            style={{ width: `${timerPercent}%`, transitionDuration: "1s" }}
          />
        </div>

        {/* Time Attack: global countdown */}
        {isTimeAttack && phase.value !== "loading" && (
          <div
            class={[
              "text-center py-1 text-3xl font-display tabular-nums",
              timerWarn ? "text-red-400" : "text-white/60",
            ]}
          >
            {timeLeft.value}s
          </div>
        )}
      </div>

      {/* ── Quadrant grid ── */}
      {currentQ.value ? (
        <div class="absolute inset-0 grid grid-cols-2 grid-rows-2">
          {QUADRANT_POSITIONS.map((pos) => {
            const opt = currentQ.value?.options.find(
              (o) => o.quadrant === pos.id,
            );
            const fb = feedback.value;
            const isChosen = fb?.chosenQ === pos.id;
            const isCorrectQ = fb?.correctQ === pos.id;
            const showGreen = Boolean(fb && isCorrectQ);
            const showRed = Boolean(fb && isChosen && !fb.correct);

            return (
              <button
                type="button"
                key={pos.id}
                class={[
                  pos.gridClass,
                  pos.border,
                  "border-white/10 relative flex p-4 md:p-6 transition-colors duration-200",
                  {
                    "bg-green-500/35": showGreen,
                    "bg-red-500/35": showRed,
                    "active:bg-white/10": !fb,
                  },
                ]}
                style={pos.extraTopPad ? { paddingTop: "72px" } : undefined}
                onClick$={() => {
                  /**
                   * Delegate to the handlePunch closure defined in
                   * useVisibleTask$. browser.onPunch is set (via noSerialize)
                   * before any user interaction is possible, so this is always
                   * non-null by the time the button is clickable.
                   */
                  browser.onPunch?.(pos.id);
                }}
              >
                <div class={`${pos.alignClass} flex w-full h-full`}>
                  <div
                    class={[
                      "relative px-5 py-3 md:px-7 md:py-4 rounded-2xl font-display text-4xl md:text-6xl transition-all duration-200 shadow-lg",
                      {
                        "bg-green-500 text-white scale-110 shadow-green-500/40":
                          showGreen,
                        "bg-red-500 text-white scale-95 shadow-red-500/40":
                          showRed,
                        "bg-black/65 text-white backdrop-blur-sm":
                          !showGreen && !showRed,
                      },
                    ]}
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
                  {currentQ.value?.text}
                </div>
                <div class="mt-2 min-h-[2.75rem] flex items-center justify-center">
                  {!isTimeAttack && phase.value === "question" ? (
                    <div
                      class={[
                        "text-4xl font-display tabular-nums leading-none transition-colors",
                        timerUrgent
                          ? "text-red-400"
                          : timerWarn
                            ? "text-orange-400"
                            : "text-yellow-400",
                      ]}
                    >
                      {timeLeft.value}
                    </div>
                  ) : feedback.value ? (
                    <div
                      class={[
                        "px-5 py-1.5 rounded-xl font-bold text-base text-white",
                        feedback.value.correct ? "bg-green-500" : "bg-red-500",
                      ]}
                    >
                      {feedback.value.correct
                        ? streak.value.current >= 3
                          ? `🔥 ${streak.value.current} streak!`
                          : "✓ Correct!"
                        : feedback.value.chosenQ
                          ? `✗ Answer: ${currentQ.value?.answer}`
                          : `⏰ Time up! Answer: ${currentQ.value?.answer}`}
                    </div>
                  ) : null}
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div class="absolute inset-0 flex items-center justify-center">
          {phase.value === "countdown" ? (
            <div
              class={[
                "font-display tabular-nums drop-shadow-2xl select-none transition-all duration-150",
                countdownVal.value === 0
                  ? "text-green-400 text-8xl"
                  : "text-white text-9xl",
              ]}
            >
              {countdownVal.value === 0 ? "GO!" : countdownVal.value}
            </div>
          ) : (
            <div class="flex flex-col items-center gap-4">
              <div class="w-10 h-10 border-4 border-yellow-400 border-t-transparent rounded-full animate-spin" />
              <p class="text-white/60 text-sm">Loading hand detection model…</p>
            </div>
          )}
        </div>
      )}

      {/* Streak toast */}
      {streakToast.value && (
        <div class="absolute top-14 left-1/2 -translate-x-1/2 z-30 bg-orange-500 text-white px-6 py-2 rounded-full font-black text-lg shadow-lg pointer-events-none animate-bounce-in">
          {streakToast.value}
        </div>
      )}

      {/* Keyboard / touch hint (no camera) */}
      {!cameraActive.value && phase.value === "question" && (
        <div class="absolute bottom-3 left-1/2 -translate-x-1/2 bg-black/60 text-white/60 text-sm px-4 py-2 rounded-full pointer-events-none">
          Tap a corner · or press <span class="font-mono">Q · E · Z · C</span>
        </div>
      )}
    </div>
  );
});

export const head: DocumentHead = {
  title: "Playing — Punch Maths",
};
