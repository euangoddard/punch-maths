import { signal } from "@preact/signals";
import CalibrationScreen from "./components/CalibrationScreen";
import GameScreen from "./components/GameScreen";
import HomeScreen from "./components/HomeScreen";
import SummaryScreen from "./components/SummaryScreen";
import { CALIBRATION_STORAGE_KEY, DEFAULT_QUESTION_TIMER } from "./constants";
import type { CalibrationData, GameConfig, GameResults, Screen } from "./types";

// Global app state signals
export const screen = signal<Screen>("home");

// Where to navigate after calibration completes ("playing" normally, "home" when recalibrating)
export const calibrationReturnTo = signal<Screen>("playing");

export const gameConfig = signal<GameConfig>({
  mode: "classic",
  difficulty: 2,
  duration: 60,
  questionTimer: DEFAULT_QUESTION_TIMER,
});

export const gameResults = signal<GameResults | null>(null);

// Calibration: stored in localStorage, null means not calibrated
function loadCalibration(): CalibrationData | null {
  try {
    const raw = localStorage.getItem(CALIBRATION_STORAGE_KEY);
    if (!raw) {
      return null;
    }
    const parsed = JSON.parse(raw);
    if (typeof parsed?.calibratedAt !== "number") {
      return null;
    }
    return parsed as CalibrationData;
  } catch {
    return null;
  }
}

export function saveCalibration(data: CalibrationData): void {
  try {
    localStorage.setItem(CALIBRATION_STORAGE_KEY, JSON.stringify(data));
  } catch {
    // Storage may be unavailable
  }
  calibrationData.value = data;
}

export const calibrationData = signal<CalibrationData | null>(
  loadCalibration(),
);

export default function App() {
  return (
    <div class="w-screen h-screen bg-indigo-950">
      {screen.value === "home" && <HomeScreen />}
      {screen.value === "calibration" && <CalibrationScreen />}
      {screen.value === "playing" && <GameScreen />}
      {screen.value === "summary" && <SummaryScreen />}
    </div>
  );
}
