import { gameConfig, gameResults, screen } from "../App";

const DIFFICULTY_LABELS: Record<number, string> = {
  1: "Easy",
  2: "Medium",
  3: "Hard",
};
const MODE_LABELS: Record<string, string> = {
  classic: "Classic",
  "time-attack": "Time Attack",
};

function getRating(accuracy: number, avgReaction: number) {
  if (accuracy >= 90 && avgReaction < 2500) {
    return { label: "Perfect!", emoji: "🏆", color: "text-yellow-400" };
  }
  if (accuracy >= 80) {
    return { label: "Excellent!", emoji: "⭐", color: "text-yellow-300" };
  }
  if (accuracy >= 60) {
    return { label: "Good job!", emoji: "👍", color: "text-green-400" };
  }
  if (accuracy >= 40) {
    return { label: "Keep going!", emoji: "💪", color: "text-blue-400" };
  }
  return {
    label: "Practice makes perfect",
    emoji: "🎯",
    color: "text-slate-300",
  };
}

export default function SummaryScreen() {
  const results = gameResults.value;
  const config = gameConfig.value;

  if (!results) {
    return null;
  }

  const rating = getRating(results.accuracy, results.avgReactionMs);
  const correctResults = results.results.filter((r) => r.correct);

  return (
    <div class="h-screen overflow-y-auto bg-indigo-950 flex flex-col items-center py-8 px-4">
      <div class="w-full max-w-md">
        {/* Header */}
        <div class="text-center mb-8">
          <div class="text-6xl mb-2">{rating.emoji}</div>
          <h1 class={`text-4xl font-display mb-1 ${rating.color}`}>
            {rating.label}
          </h1>
          <p class="text-white/50 text-sm">
            {MODE_LABELS[results.mode]} ·{" "}
            {DIFFICULTY_LABELS[results.difficulty]}
          </p>
        </div>

        {/* Main stats — score hero + secondary row */}
        <div class="mb-3">
          <StatCard
            value={results.score}
            label="Score"
            sub={
              config.mode === "classic"
                ? `out of ${results.total}`
                : "correct answers"
            }
            highlight
          />
        </div>
        <div class="grid grid-cols-3 gap-3 mb-6">
          <StatCard
            value={`${results.accuracy}%`}
            label="Accuracy"
            sub={`${correctResults.length} / ${results.results.length}`}
            color={
              results.accuracy >= 80
                ? "text-green-400"
                : results.accuracy >= 60
                  ? "text-yellow-400"
                  : "text-red-400"
            }
          />
          <StatCard
            value={
              results.avgReactionMs > 0
                ? `${(results.avgReactionMs / 1000).toFixed(1)}s`
                : "—"
            }
            label="Reaction"
            sub="avg per Q"
          />
          <StatCard
            value={results.bestStreak}
            label="Streak"
            sub={results.bestStreak >= 3 ? "🔥 on fire!" : "best in a row"}
            color={
              results.bestStreak >= 5
                ? "text-orange-400"
                : results.bestStreak >= 3
                  ? "text-yellow-400"
                  : "text-white/55"
            }
          />
        </div>

        {/* Question breakdown */}
        {results.results.length > 0 && (
          <div class="bg-white/8 rounded-2xl overflow-hidden mb-6">
            <div class="px-4 py-3 border-b border-white/10">
              <h2 class="font-bold text-white text-sm">Question breakdown</h2>
            </div>
            <div class="divide-y divide-white/8">
              {results.results.map((r, i) => (
                <div
                  key={i}
                  class={`flex items-center gap-3 px-4 py-2.5 border-l-2 ${r.correct ? "border-emerald-500" : "border-red-500"}`}
                >
                  <span
                    class={`text-lg ${r.correct ? "text-emerald-400" : "text-red-400"}`}
                  >
                    {r.correct ? "✓" : "✗"}
                  </span>
                  <span class="text-white font-mono text-sm flex-1">
                    {r.question} ={" "}
                    <span class="text-yellow-400 font-bold">{r.answer}</span>
                  </span>
                  <span class="text-white/35 text-xs tabular-nums">
                    {r.reactionMs > 0
                      ? `${(r.reactionMs / 1000).toFixed(1)}s`
                      : "timeout"}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Action buttons */}
        <div class="flex flex-col gap-3">
          <button
            type="button"
            onClick={() => {
              screen.value = "playing";
            }}
            class="btn-primary"
          >
            Play again 👊
          </button>
          <button
            type="button"
            onClick={() => {
              screen.value = "home";
            }}
            class="btn-secondary"
          >
            Change settings
          </button>
        </div>

        {/* Encouragement message */}
        {results.accuracy < 60 && (
          <div class="mt-4 bg-blue-900/50 border border-blue-700/50 rounded-xl p-4 text-sm text-blue-200">
            <p class="font-semibold text-blue-300 mb-1">💡 Tip</p>
            <p>
              Try Easy difficulty to build confidence with the mechanics, then
              work up!
            </p>
          </div>
        )}
        {results.accuracy === 100 && (
          <div class="mt-4 bg-yellow-900/50 border border-yellow-700/50 rounded-xl p-4 text-sm text-yellow-200">
            <p class="font-semibold text-yellow-300 mb-1">🌟 Perfect round!</p>
            <p>Try a harder difficulty to challenge yourself further!</p>
          </div>
        )}
      </div>
    </div>
  );
}

interface StatCardProps {
  value: string | number;
  label: string;
  sub?: string;
  highlight?: boolean;
  color?: string;
}

function StatCard({ value, label, sub, highlight, color }: StatCardProps) {
  return (
    <div
      class={`rounded-2xl text-center ${highlight ? "p-6 bg-yellow-400/10 border-2 border-yellow-400/50" : "p-4 bg-white/8"}`}
    >
      <div
        class={`font-display mb-0.5 ${highlight ? "text-5xl" : "text-3xl"} ${color ?? (highlight ? "text-yellow-400" : "text-white")}`}
      >
        {value}
      </div>
      <div
        class={`text-white font-semibold ${highlight ? "text-base" : "text-sm"}`}
      >
        {label}
      </div>
      {sub && (
        <div
          class={`text-white/45 mt-0.5 ${highlight ? "text-sm" : "text-xs"}`}
        >
          {sub}
        </div>
      )}
    </div>
  );
}
