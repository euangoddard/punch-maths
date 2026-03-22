// Question generation engine for Punch Maths
// Covers Tiers 1–3: addition/subtraction through mixed operations up to 100

import type { Quadrant, Question, QuestionOption } from "../types";

type Op = "+" | "-" | "*" | "/";

interface RawQuestion {
  text: string;
  answer: number;
  op: Op;
  a: number;
  b: number;
}

function randInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// Tier 1: Addition and subtraction, numbers 1–20
function generateTier1(): RawQuestion {
  const useAdd = Math.random() < 0.55;
  if (useAdd) {
    const a = randInt(1, 15);
    const b = randInt(1, 20 - a);
    return { text: `${a} + ${b}`, answer: a + b, op: "+", a, b };
  } else {
    const a = randInt(5, 20);
    const b = randInt(1, a - 1);
    return { text: `${a} \u2212 ${b}`, answer: a - b, op: "-", a, b };
  }
}

// Tier 2: Multiplication and division with 1–12 tables
function generateTier2(): RawQuestion {
  const useMul = Math.random() < 0.55;
  if (useMul) {
    const a = randInt(2, 12);
    const b = randInt(2, 12);
    return { text: `${a} \u00D7 ${b}`, answer: a * b, op: "*", a, b };
  } else {
    const b = randInt(2, 12);
    const answer = randInt(2, 12);
    const a = b * answer;
    return { text: `${a} \u00F7 ${b}`, answer, op: "/", a, b };
  }
}

// Tier 3: Mixed operations with larger numbers up to 100
function generateTier3(): RawQuestion {
  const ops: Op[] = ["+", "-", "*", "/"];
  const op = ops[randInt(0, 3)];
  switch (op) {
    case "+": {
      const a = randInt(15, 80);
      const b = randInt(10, 100 - a);
      return { text: `${a} + ${b}`, answer: a + b, op, a, b };
    }
    case "-": {
      const a = randInt(30, 100);
      const b = randInt(5, a - 10);
      return { text: `${a} \u2212 ${b}`, answer: a - b, op, a, b };
    }
    case "*": {
      const a = randInt(3, 15);
      const b = randInt(3, 12);
      return { text: `${a} \u00D7 ${b}`, answer: a * b, op, a, b };
    }
    case "/": {
      const b = randInt(3, 12);
      const answer = randInt(3, 12);
      const a = b * answer;
      return { text: `${a} \u00F7 ${b}`, answer, op, a, b };
    }
  }
}

// Generate plausible distractors — wrong answers that feel believable
function generateDistractors(
  answer: number,
  op: Op,
  a: number,
  b: number,
): number[] {
  const distractors = new Set<number>();

  // Strategy 1: adjacent operand errors (e.g. for 7×8, offer 7×7=49 or 7×9=63)
  if (op === "*") {
    distractors.add(a * (b - 1));
    distractors.add(a * (b + 1));
    distractors.add((a - 1) * b);
    distractors.add((a + 1) * b);
  }
  if (op === "/") {
    distractors.add(answer - 1);
    distractors.add(answer + 1);
    distractors.add(answer + 2);
    distractors.add(answer - 2);
  }
  if (op === "+") {
    distractors.add(answer - 1);
    distractors.add(answer + 1);
    distractors.add(answer - 2);
    distractors.add(a + b + 1);
  }
  if (op === "-") {
    distractors.add(answer + 1);
    distractors.add(answer - 1);
    distractors.add(a - (b - 1));
    distractors.add(a - (b + 1));
  }

  // Strategy 2: digit reversal for multi-digit answers
  const ansStr = String(answer);
  if (ansStr.length >= 2) {
    const reversed = parseInt(ansStr.split("").reverse().join(""), 10);
    if (reversed !== answer && reversed > 0) {
      distractors.add(reversed);
    }
  }

  // Strategy 3: off-by-small-amounts
  for (const delta of [-3, -2, -1, 1, 2, 3]) {
    distractors.add(answer + delta);
  }

  // Filter out the correct answer and non-positive values, deduplicate
  const valid = [...distractors].filter(
    (v) => v !== answer && v > 0 && Number.isInteger(v),
  );

  // Shuffle and take 3
  return shuffle(valid).slice(0, 3);
}

// Main export: generate a complete question with shuffled options
export function generateQuestion(tier = 2): Question {
  const generators: Record<number, () => RawQuestion> = {
    1: generateTier1,
    2: generateTier2,
    3: generateTier3,
  };
  const gen = generators[tier] ?? generateTier2;
  const q = gen();

  const distractors = generateDistractors(q.answer, q.op, q.a, q.b);

  // Safety: if we couldn't get 3 distractors, pad with random nearby values
  let padAttempts = 0;
  while (distractors.length < 3 && padAttempts < 50) {
    padAttempts++;
    const candidate =
      q.answer + randInt(1, 10) * (Math.random() < 0.5 ? 1 : -1);
    if (
      candidate > 0 &&
      candidate !== q.answer &&
      !distractors.includes(candidate)
    ) {
      distractors.push(candidate);
    }
  }

  // Build options array: [answer, d1, d2, d3], then shuffle and assign quadrants
  const optionValues = shuffle([q.answer, ...distractors.slice(0, 3)]);
  const quadrants: Quadrant[] = [
    "top-left",
    "top-right",
    "bottom-left",
    "bottom-right",
  ];

  const options: QuestionOption[] = optionValues.map((value, i) => ({
    value,
    quadrant: quadrants[i],
    isCorrect: value === q.answer,
  }));

  return {
    text: q.text,
    answer: q.answer,
    options,
    tier,
  };
}
