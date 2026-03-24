import {
  component$,
  Slot,
  useContextProvider,
  useSignal,
  useVisibleTask$,
} from "@builder.io/qwik";
import type { RequestHandler } from "@builder.io/qwik-city";
import { CALIBRATION_STORAGE_KEY, DEFAULT_QUESTION_TIMER } from "../constants";
import {
  CalibrationContext,
  CalibrationReturnToContext,
  GameConfigContext,
  GameResultsContext,
} from "../context/game";
import type { CalibrationData, GameConfig, GameResults } from "../types";

export const onGet: RequestHandler = async ({ cacheControl }) => {
  cacheControl({ noCache: true });
};

export default component$(() => {
  const gameConfig = useSignal<GameConfig>({
    mode: "classic",
    difficulty: 2,
    duration: 60,
    questionTimer: DEFAULT_QUESTION_TIMER,
  });
  const gameResults = useSignal<GameResults | null>(null);
  const calibrationData = useSignal<CalibrationData | null>(null);
  const calibrationReturnTo = useSignal("/play");

  useContextProvider(GameConfigContext, gameConfig);
  useContextProvider(GameResultsContext, gameResults);
  useContextProvider(CalibrationContext, calibrationData);
  useContextProvider(CalibrationReturnToContext, calibrationReturnTo);

  // Load calibration from localStorage once the browser is ready
  // biome-ignore lint/correctness/noQwikUseVisibleTask: localStorage is browser-only
  useVisibleTask$(() => {
    try {
      const raw = localStorage.getItem(CALIBRATION_STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as CalibrationData;
        if (typeof parsed.calibratedAt === "number") {
          calibrationData.value = parsed;
        }
      }
    } catch {
      // localStorage may be unavailable
    }
  });

  return (
    <main>
      <Slot />
    </main>
  );
});
