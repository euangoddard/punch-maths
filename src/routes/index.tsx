import { component$, useContext, useSignal } from "@builder.io/qwik";
import type { DocumentHead } from "@builder.io/qwik-city";
import { useNavigate } from "@builder.io/qwik-city";
import { unlockAudio } from "../audio/sounds";
import { DEFAULT_QUESTION_TIMER } from "../constants";
import {
  CalibrationContext,
  CalibrationReturnToContext,
  GameConfigContext,
} from "../context/game";
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
] as const;

const DURATIONS = [
  { value: 60, label: "60s" },
  { value: 90, label: "90s" },
  { value: 120, label: "2min" },
] as const;

export default component$(() => {
  const gameConfigSignal = useContext(GameConfigContext);
  const calibrationData = useContext(CalibrationContext);
  const calibrationReturnTo = useContext(CalibrationReturnToContext);
  const nav = useNavigate();

  const mode = useSignal<GameMode>(gameConfigSignal.value.mode);
  const difficulty = useSignal(gameConfigSignal.value.difficulty);
  const duration = useSignal(gameConfigSignal.value.duration);
  const showKeyboardNote = useSignal(false);

  return (
    <div class="min-h-screen flex flex-col items-center justify-center bg-indigo-950 px-4 py-8 select-none overflow-y-auto">
      {/* Title */}
      <div class="text-center mb-8">
        <div class="text-8xl mb-2" role="img" aria-label="punch">
          👊
        </div>
        <h1 class="text-5xl sm:text-7xl font-display tracking-tight text-white mb-2 leading-none">
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
            active={mode.value === "classic"}
            onClick$={() => {
              mode.value = "classic";
            }}
            emoji="🎯"
            title="Classic"
            desc="10 questions, 5s each"
            activeColorClass="border-yellow-400 bg-yellow-400/10"
          />
          <ModeCard
            active={mode.value === "time-attack"}
            onClick$={() => {
              mode.value = "time-attack";
            }}
            emoji="⏱️"
            title="Time Attack"
            desc="Unlimited questions, race the clock"
            activeColorClass="border-sky-400 bg-sky-400/10"
          />
        </div>

        {mode.value === "time-attack" && (
          <div class="mt-3 flex gap-2 justify-center">
            {DURATIONS.map((d) => (
              <button
                type="button"
                key={d.value}
                onClick$={() => {
                  duration.value = d.value;
                }}
                class={[
                  "px-4 py-2 rounded-lg font-bold text-sm transition-all",
                  duration.value === d.value
                    ? "bg-yellow-400 text-slate-900"
                    : "bg-white/10 text-white/70 hover:bg-white/20",
                ]}
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
              onClick$={() => {
                difficulty.value = d.value;
              }}
              class={[
                "p-3 rounded-xl border-2 transition-all text-center",
                difficulty.value === d.value
                  ? d.activeClass
                  : "border-white/10 bg-white/5 text-white/60 hover:border-white/25",
              ]}
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

      {/* Mechanic hint */}
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
            onClick$={() => {
              unlockAudio();
              gameConfigSignal.value = {
                mode: mode.value,
                difficulty: difficulty.value,
                duration: duration.value,
                questionTimer: DEFAULT_QUESTION_TIMER,
              };
              if (calibrationData.value) {
                nav("/play");
              } else {
                calibrationReturnTo.value = "/play";
                nav("/calibration");
              }
            }}
            class="btn-primary hover:scale-[1.02] shadow-xl shadow-yellow-400/30"
          >
            📷 Play with Camera
          </button>
          {calibrationData.value && (
            <button
              type="button"
              onClick$={() => {
                calibrationReturnTo.value = "/";
                nav("/calibration");
              }}
              class="text-white/40 text-xs hover:text-white/60 transition-colors text-center py-1"
            >
              Recalibrate camera
            </button>
          )}
        </div>
        <button
          type="button"
          onClick$={() => {
            unlockAudio();
            gameConfigSignal.value = {
              mode: mode.value,
              difficulty: difficulty.value,
              duration: duration.value,
              questionTimer: DEFAULT_QUESTION_TIMER,
              keyboardOnly: true,
            };
            nav("/play");
          }}
          class="btn-secondary"
        >
          ⌨️ Play with Keyboard / Touch
        </button>
      </div>

      {/* Controls hint */}
      <button
        type="button"
        onClick$={() => {
          showKeyboardNote.value = !showKeyboardNote.value;
        }}
        class="mt-4 text-white/60 text-sm hover:text-white/80 transition-colors"
      >
        How to play {showKeyboardNote.value ? "▲" : "▼"}
      </button>

      {showKeyboardNote.value && (
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
});

interface ModeCardProps {
  active: boolean;
  onClick$: () => void;
  emoji: string;
  title: string;
  desc: string;
  activeColorClass: string;
}

const ModeCard = component$<ModeCardProps>(
  ({ active, onClick$: handleClick, emoji, title, desc, activeColorClass }) => (
    <button
      type="button"
      onClick$={handleClick}
      class={[
        "p-4 rounded-xl border-2 transition-all text-left",
        active
          ? `${activeColorClass} text-white`
          : "border-white/10 bg-white/5 text-white/60 hover:border-white/25",
      ]}
    >
      <div class="text-2xl mb-1">{emoji}</div>
      <div class="font-bold">{title}</div>
      <div class="text-xs text-white/60 mt-0.5">{desc}</div>
    </button>
  ),
);

export const head: DocumentHead = {
  title: "Punch Maths",
  meta: [
    {
      name: "description",
      content: "Punch Maths — physical maths game using your webcam",
    },
    { property: "og:type", content: "website" },
    { property: "og:title", content: "Punch Maths" },
    {
      property: "og:description",
      content: "Physical maths game using your webcam",
    },
    {
      property: "og:url",
      content: "https://punch-maths.euans.space/",
    },
    {
      property: "og:image",
      content: "https://punch-maths.euans.space/og-image.png",
    },
    { name: "twitter:card", content: "summary_large_image" },
    { name: "twitter:title", content: "Punch Maths" },
    {
      name: "twitter:description",
      content: "Physical maths game using your webcam",
    },
    {
      name: "twitter:image",
      content: "https://punch-maths.euans.space/og-image.png",
    },
  ],
};
