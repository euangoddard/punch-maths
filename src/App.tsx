import { signal } from "@preact/signals";
import CalibrationScreen from "./components/CalibrationScreen";
import GameScreen from "./components/GameScreen";
import HomeScreen from "./components/HomeScreen";
import SummaryScreen from "./components/SummaryScreen";
import type { CalibrationData, GameConfig, GameResults, Screen } from "./types";

// Global app state signals
export const screen = signal<Screen>("home");

export const gameConfig = signal<GameConfig>({
  mode: "classic",
  difficulty: 2,
  duration: 60,
  questionTimer: 5,
});

export const gameResults = signal<GameResults | null>(null);

// Calibration: stored in localStorage, null means not calibrated
function loadCalibration(): CalibrationData | null {
  try {
    const raw = localStorage.getItem("punch-maths-calibration");
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (
      typeof parsed?.threshold !== "number" ||
      typeof parsed?.calibratedAt !== "number"
    ) {
      return null;
    }
    return parsed as CalibrationData;
  } catch {
    return null;
  }
}

export function saveCalibration(data: CalibrationData): void {
  try {
    localStorage.setItem("punch-maths-calibration", JSON.stringify(data));
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
    <div class="h-screen w-screen overflow-hidden bg-slate-900">
      {screen.value === "home" && <HomeScreen />}
      {screen.value === "calibration" && <CalibrationScreen />}
      {screen.value === "playing" && <GameScreen />}
      {screen.value === "summary" && <SummaryScreen />}
    </div>
  );
}
