import { useState } from "preact/hooks";
import {
  calibrationData,
  calibrationReturnTo,
  gameConfig,
  screen,
} from "../App";
import { unlockAudio } from "../audio/sounds";
import { DEFAULT_QUESTION_TIMER } from "../constants";
import type { GameMode } from "../types";

const DIFFICULTIES = [
  {
    value: 1 as const,
    label: "Easy",
    desc: "Add & subtract up to 20",
    emoji: "🌱",
    activeClass: "border-emerald-400 bg-emerald-400/10 text-white",
  },
  {
    value: 2 as const,
    label: "Medium",
    desc: "Times tables up to 12",
    emoji: "⚡",
    activeClass: "border-sky-400 bg-sky-400/10 text-white",
  },
  {
    value: 3 as const,
    label: "Hard",
    desc: "Mixed ops up to 100",
    emoji: "🔥",
    activeClass: "border-orange-400 bg-orange-400/10 text-white",
  },
];

const DURATIONS = [
  { value: 60, label: "60s" },
  { value: 90, label: "90s" },
  { value: 120, label: "2min" },
];

export default function HomeScreen() {
  const [mode, setMode] = useState<GameMode>(gameConfig.value.mode);
  const [difficulty, setDifficulty] = useState(gameConfig.value.difficulty);
  const [duration, setDuration] = useState(gameConfig.value.duration);
  const [showKeyboardNote, setShowKeyboardNote] = useState(false);

  function handlePlay() {
    unlockAudio();
    gameConfig.value = {
      mode,
      difficulty,
      duration,
      questionTimer: DEFAULT_QUESTION_TIMER,
    };

    // Skip calibration if already done, otherwise show it
    if (calibrationData.value) {
      screen.value = "playing";
    } else {
      screen.value = "calibration";
    }
  }

  function handlePlayKeyboard() {
    unlockAudio();
    gameConfig.value = {
      mode,
      difficulty,
      duration,
      questionTimer: DEFAULT_QUESTION_TIMER,
      keyboardOnly: true,
    };
    screen.value = "playing";
  }

  return (
    <div class="min-h-screen flex flex-col items-center justify-center bg-indigo-950 px-4 py-8 select-none overflow-y-auto">
      {/* Title */}
      <div class="text-center mb-8">
        <div class="text-8xl mb-2" role="img" aria-label="punch">
          👊
        </div>
        <h1 class="text-7xl font-display tracking-tight text-white mb-2 leading-none">
          PUNCH<span class="text-yellow-400">MATHS</span>
        </h1>
        <p class="text-white/60 text-base">
          Punch the right answer before time runs out
        </p>
      </div>

      {/* Mode selection */}
      <div class="w-full max-w-md mb-5">
        <p class="text-white/60 text-sm font-semibold uppercase tracking-wider mb-3 text-center">
          Mode
        </p>
        <div class="grid grid-cols-2 gap-3">
          <ModeCard
            active={mode === "classic"}
            onClick={() => setMode("classic")}
            emoji="🎯"
            title="Classic"
            desc="10 questions, 5s each"
            activeColorClass="border-yellow-400 bg-yellow-400/10"
          />
          <ModeCard
            active={mode === "time-attack"}
            onClick={() => setMode("time-attack")}
            emoji="⏱️"
            title="Time Attack"
            desc="Unlimited questions, race the clock"
            activeColorClass="border-sky-400 bg-sky-400/10"
          />
        </div>

        {mode === "time-attack" && (
          <div class="mt-3 flex gap-2 justify-center">
            {DURATIONS.map((d) => (
              <button
                type="button"
                key={d.value}
                onClick={() => setDuration(d.value)}
                class={`px-4 py-2 rounded-lg font-bold text-sm transition-all ${
                  duration === d.value
                    ? "bg-yellow-400 text-slate-900"
                    : "bg-white/10 text-white/70 hover:bg-white/20"
                }`}
              >
                {d.label}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Difficulty selection */}
      <div class="w-full max-w-md mb-3">
        <p class="text-white/60 text-sm font-semibold uppercase tracking-wider mb-3 text-center">
          Difficulty
        </p>
        <div class="grid grid-cols-3 gap-3">
          {DIFFICULTIES.map((d) => (
            <button
              type="button"
              key={d.value}
              onClick={() => setDifficulty(d.value)}
              class={`p-3 rounded-xl border-2 transition-all text-center ${
                difficulty === d.value
                  ? d.activeClass
                  : "border-white/10 bg-white/5 text-white/60 hover:border-white/25"
              }`}
            >
              <div class="text-2xl mb-1">{d.emoji}</div>
              <div class="font-bold text-sm">{d.label}</div>
              <div class="text-xs text-white/60 mt-0.5 leading-tight">
                {d.desc}
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Mechanic hint — always visible, one sentence */}
      <div class="w-full max-w-md mb-4">
        <div class="flex items-center gap-3 bg-white/5 border border-white/10 rounded-2xl px-4 py-3">
          <span class="text-2xl flex-shrink-0">👊</span>
          <p class="text-white/70 text-sm leading-snug">
            Punch or swipe toward the corner showing the right answer — or just
            tap it on screen.
          </p>
        </div>
      </div>

      {/* Play buttons */}
      <div class="w-full max-w-md flex flex-col gap-3">
        <div class="flex flex-col items-stretch gap-1">
          <button
            type="button"
            onClick={handlePlay}
            class="btn-primary hover:scale-[1.02] shadow-xl shadow-yellow-400/30"
          >
            📷 Play with Camera
          </button>
          {calibrationData.value && (
            <button
              type="button"
              onClick={() => {
                calibrationReturnTo.value = "home";
                screen.value = "calibration";
              }}
              class="text-white/40 text-xs hover:text-white/60 transition-colors text-center py-1"
            >
              Recalibrate camera
            </button>
          )}
        </div>
        <button
          type="button"
          onClick={handlePlayKeyboard}
          class="btn-secondary"
        >
          ⌨️ Play with Keyboard / Touch
        </button>
      </div>

      {/* Controls hint */}
      <button
        type="button"
        onClick={() => setShowKeyboardNote((v) => !v)}
        class="mt-4 text-white/60 text-sm hover:text-white/80 transition-colors"
      >
        How to play {showKeyboardNote ? "▲" : "▼"}
      </button>

      {showKeyboardNote && (
        <div class="mt-3 bg-white/10 rounded-xl p-4 max-w-md w-full text-sm text-white/70">
          <p class="font-semibold text-white mb-2">Camera mode:</p>
          <p class="mb-3">
            Punch or swipe your hand toward the corner of the screen with the
            correct answer.
          </p>
          <p class="font-semibold text-white mb-2">Keyboard shortcuts:</p>
          <div class="grid grid-cols-2 gap-1 font-mono text-xs">
            <span class="bg-white/10 rounded px-2 py-1">Q → Top Left</span>
            <span class="bg-white/10 rounded px-2 py-1">E → Top Right</span>
            <span class="bg-white/10 rounded px-2 py-1">Z → Bottom Left</span>
            <span class="bg-white/10 rounded px-2 py-1">C → Bottom Right</span>
          </div>
          <p class="mt-2 text-white/60">
            Or tap/click any quadrant on touch screens.
          </p>
        </div>
      )}
    </div>
  );
}

interface ModeCardProps {
  active: boolean;
  onClick: () => void;
  emoji: string;
  title: string;
  desc: string;
  activeColorClass: string;
}

function ModeCard({
  active,
  onClick,
  emoji,
  title,
  desc,
  activeColorClass,
}: ModeCardProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      class={`p-4 rounded-xl border-2 transition-all text-left ${
        active
          ? `${activeColorClass} text-white`
          : "border-white/10 bg-white/5 text-white/60 hover:border-white/25"
      }`}
    >
      <div class="text-2xl mb-1">{emoji}</div>
      <div class="font-bold">{title}</div>
      <div class="text-xs text-white/60 mt-0.5">{desc}</div>
    </button>
  );
}
