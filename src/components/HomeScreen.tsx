import { useState } from "preact/hooks";
import { calibrationData, gameConfig, screen } from "../App";
import { unlockAudio } from "../audio/sounds";
import type { GameMode } from "../types";

const DIFFICULTIES = [
  {
    value: 1 as const,
    label: "Easy",
    desc: "Add & subtract up to 20",
    emoji: "🌱",
  },
  {
    value: 2 as const,
    label: "Medium",
    desc: "Times tables up to 12",
    emoji: "⚡",
  },
  {
    value: 3 as const,
    label: "Hard",
    desc: "Mixed ops up to 100",
    emoji: "🔥",
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
    gameConfig.value = { mode, difficulty, duration, questionTimer: 5 };

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
      questionTimer: 5,
      keyboardOnly: true,
    };
    screen.value = "playing";
  }

  return (
    <div class="h-screen flex flex-col items-center justify-center bg-slate-900 px-4 select-none">
      {/* Title */}
      <div class="text-center mb-8">
        <div class="text-7xl mb-3" role="img" aria-label="punch">
          👊
        </div>
        <h1 class="text-5xl font-black tracking-tight text-white mb-2">
          Punch<span class="text-yellow-400">Maths</span>
        </h1>
        <p class="text-slate-400 text-lg">
          Punch the right answer before time runs out
        </p>
      </div>

      {/* Mode selection */}
      <div class="w-full max-w-md mb-6">
        <p class="text-slate-400 text-sm font-semibold uppercase tracking-widest mb-3 text-center">
          Mode
        </p>
        <div class="grid grid-cols-2 gap-3">
          <ModeCard
            active={mode === "classic"}
            onClick={() => setMode("classic")}
            emoji="🎯"
            title="Classic"
            desc="10 questions, 5s each"
          />
          <ModeCard
            active={mode === "time-attack"}
            onClick={() => setMode("time-attack")}
            emoji="⏱️"
            title="Time Attack"
            desc="Unlimited questions, race the clock"
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
                    : "bg-slate-700 text-slate-300 hover:bg-slate-600"
                }`}
              >
                {d.label}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Difficulty selection */}
      <div class="w-full max-w-md mb-8">
        <p class="text-slate-400 text-sm font-semibold uppercase tracking-widest mb-3 text-center">
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
                  ? "border-yellow-400 bg-yellow-400/10 text-white"
                  : "border-slate-700 bg-slate-800 text-slate-400 hover:border-slate-500"
              }`}
            >
              <div class="text-2xl mb-1">{d.emoji}</div>
              <div class="font-bold text-sm">{d.label}</div>
              <div class="text-xs text-slate-400 mt-0.5 leading-tight">
                {d.desc}
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Play buttons */}
      <div class="w-full max-w-md flex flex-col gap-3">
        <button
          type="button"
          onClick={handlePlay}
          class="w-full py-4 rounded-2xl bg-yellow-400 hover:bg-yellow-300 text-slate-900 font-black text-xl transition-all active:scale-95 shadow-lg shadow-yellow-400/20"
        >
          📷 Play with Camera
        </button>
        <button
          type="button"
          onClick={handlePlayKeyboard}
          class="w-full py-3 rounded-2xl bg-slate-700 hover:bg-slate-600 text-white font-bold text-base transition-all active:scale-95"
        >
          ⌨️ Play with Keyboard / Touch
        </button>
      </div>

      {/* Controls hint */}
      <button
        type="button"
        onClick={() => setShowKeyboardNote((v) => !v)}
        class="mt-4 text-slate-500 text-sm hover:text-slate-300 transition-colors"
      >
        How to play {showKeyboardNote ? "▲" : "▼"}
      </button>

      {showKeyboardNote && (
        <div class="mt-3 bg-slate-800 rounded-xl p-4 max-w-md w-full text-sm text-slate-300">
          <p class="font-semibold text-white mb-2">Camera mode:</p>
          <p class="mb-3">
            Punch or swipe your hand toward the corner of the screen with the
            correct answer.
          </p>
          <p class="font-semibold text-white mb-2">Keyboard shortcuts:</p>
          <div class="grid grid-cols-2 gap-1 font-mono text-xs">
            <span class="bg-slate-700 rounded px-2 py-1">Q → Top Left</span>
            <span class="bg-slate-700 rounded px-2 py-1">E → Top Right</span>
            <span class="bg-slate-700 rounded px-2 py-1">Z → Bottom Left</span>
            <span class="bg-slate-700 rounded px-2 py-1">C → Bottom Right</span>
          </div>
          <p class="mt-2 text-slate-400">
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
}

function ModeCard({ active, onClick, emoji, title, desc }: ModeCardProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      class={`p-4 rounded-xl border-2 transition-all text-left ${
        active
          ? "border-yellow-400 bg-yellow-400/10 text-white"
          : "border-slate-700 bg-slate-800 text-slate-400 hover:border-slate-500"
      }`}
    >
      <div class="text-2xl mb-1">{emoji}</div>
      <div class="font-bold">{title}</div>
      <div class="text-xs text-slate-400 mt-0.5">{desc}</div>
    </button>
  );
}
