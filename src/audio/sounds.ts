// Web Audio API sound effects — no external assets needed
// All sounds are synthesised on-the-fly

declare global {
  interface Window {
    webkitAudioContext?: typeof AudioContext;
  }
}

let ctx: AudioContext | null = null;

function getCtx(): AudioContext {
  if (!ctx) {
    ctx = new (
      window.AudioContext || (window.webkitAudioContext as typeof AudioContext)
    )();
  }
  return ctx;
}

function playTone(
  frequency: number,
  duration: number,
  type: OscillatorType = "sine",
  gain = 0.3,
  startTime = 0,
): void {
  try {
    const ac = getCtx();
    const t = ac.currentTime + startTime;

    const osc = ac.createOscillator();
    const gainNode = ac.createGain();

    osc.connect(gainNode);
    gainNode.connect(ac.destination);

    osc.type = type;
    osc.frequency.setValueAtTime(frequency, t);

    gainNode.gain.setValueAtTime(0, t);
    gainNode.gain.linearRampToValueAtTime(gain, t + 0.01);
    gainNode.gain.exponentialRampToValueAtTime(0.001, t + duration);

    osc.start(t);
    osc.stop(t + duration + 0.05);
  } catch {
    // Audio context may be unavailable
  }
}

// Correct answer: bright ascending arpeggio
export function playCorrect(): void {
  playTone(523, 0.15, "sine", 0.35, 0); // C5
  playTone(659, 0.15, "sine", 0.35, 0.1); // E5
  playTone(784, 0.25, "sine", 0.35, 0.2); // G5
  playTone(1047, 0.3, "sine", 0.25, 0.32); // C6
}

// Wrong answer: descending dissonant tone
export function playWrong(): void {
  playTone(392, 0.15, "sawtooth", 0.2, 0);
  playTone(311, 0.3, "sawtooth", 0.2, 0.1);
  playTone(261, 0.4, "sawtooth", 0.15, 0.25);
}

// Countdown beep (used at 3, 2, 1 seconds)
export function playBeep(urgent = false): void {
  const freq = urgent ? 880 : 660;
  playTone(freq, 0.12, "sine", 0.25, 0);
}

// Punch registered — satisfying thud
export function playPunch(): void {
  try {
    const ac = getCtx();
    const t = ac.currentTime;
    const bufSize = ac.sampleRate * 0.15;
    const buffer = ac.createBuffer(1, bufSize, ac.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufSize; i++) {
      data[i] = (Math.random() * 2 - 1) * (1 - i / bufSize) ** 3;
    }
    const source = ac.createBufferSource();
    source.buffer = buffer;
    const gainNode = ac.createGain();
    const filter = ac.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.value = 200;
    source.connect(filter);
    filter.connect(gainNode);
    gainNode.connect(ac.destination);
    gainNode.gain.setValueAtTime(0.8, t);
    gainNode.gain.exponentialRampToValueAtTime(0.001, t + 0.15);
    source.start(t);
  } catch {
    // Audio context may be unavailable
  }
}

// Round complete — triumphant
export function playRoundComplete(): void {
  const notes = [523, 659, 784, 1047, 784, 1047, 1175, 1568];
  notes.forEach((freq, i) => {
    playTone(freq, 0.2, "sine", 0.3, i * 0.12);
  });
}

// Unlock audio context on first user gesture (required by browsers)
export function unlockAudio(): void {
  try {
    const ac = getCtx();
    if (ac.state === "suspended") {
      ac.resume();
    }
  } catch {
    // Audio context may be unavailable
  }
}
