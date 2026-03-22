export type Screen = "home" | "calibration" | "playing" | "summary";

export type GameMode = "classic" | "time-attack";

export type Quadrant =
  | "top-left"
  | "top-right"
  | "bottom-left"
  | "bottom-right";

export interface GameConfig {
  mode: GameMode;
  difficulty: 1 | 2 | 3;
  duration: number;
  questionTimer: number;
  keyboardOnly?: boolean;
}

export interface CalibrationData {
  threshold: number;
  calibratedAt: number;
  noCamera?: boolean;
}

export interface QuestionOption {
  value: number;
  quadrant: Quadrant;
  isCorrect: boolean;
}

export interface Question {
  text: string;
  answer: number;
  options: QuestionOption[];
  tier: number;
}

export interface GameResult {
  question: string;
  answer: number;
  chosenQ: Quadrant | null;
  correctQ: Quadrant | undefined;
  correct: boolean;
  reactionMs: number;
}

export interface GameResults {
  score: number;
  total: number;
  accuracy: number;
  avgReactionMs: number;
  bestStreak: number;
  results: GameResult[];
  mode: GameMode;
  difficulty: number;
}

export interface Feedback {
  chosenQ: Quadrant | null;
  correctQ: Quadrant | undefined;
  correct: boolean;
}

export interface Streak {
  current: number;
  best: number;
}
