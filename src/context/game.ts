import type { Signal } from "@builder.io/qwik";
import { createContextId } from "@builder.io/qwik";
import type { CalibrationData, GameConfig, GameResults } from "../types";

/** Shared game configuration (mode, difficulty, duration, etc.) */
export const GameConfigContext = createContextId<Signal<GameConfig>>(
  "punch-maths.game-config",
);

/** Results from the most recently completed round */
export const GameResultsContext = createContextId<Signal<GameResults | null>>(
  "punch-maths.game-results",
);

/** Calibration state loaded from / persisted to localStorage */
export const CalibrationContext = createContextId<
  Signal<CalibrationData | null>
>("punch-maths.calibration");

/**
 * Where to navigate after calibration completes.
 * Normally "/play"; set to "/" when recalibrating from the home screen.
 */
export const CalibrationReturnToContext = createContextId<Signal<string>>(
  "punch-maths.calibration-return-to",
);
