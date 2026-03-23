import { useEffect, useRef, useState } from "preact/hooks";
import { calibrationReturnTo, saveCalibration, screen } from "../App";
import { HandOverlay } from "../detection/handOverlay";
import type { Quadrant } from "../types";

type CalibrationStep = "setup" | "loading" | "hitting" | "done";

const ALL_QUADRANTS: Quadrant[] = [
  "top-left",
  "top-right",
  "bottom-left",
  "bottom-right",
];

const QUADRANT_META: Record<
  Quadrant,
  {
    arrow: string;
    gridClass: string;
    alignClass: string;
    border: string;
    padding: string;
  }
> = {
  "top-left": {
    arrow: "↖",
    gridClass: "col-start-1 row-start-1",
    alignClass: "items-start justify-start",
    border: "border-r border-b",
    padding: "p-8",
  },
  "top-right": {
    arrow: "↗",
    gridClass: "col-start-2 row-start-1",
    alignClass: "items-start justify-end",
    border: "border-b",
    padding: "p-8",
  },
  "bottom-left": {
    arrow: "↙",
    gridClass: "col-start-1 row-start-2",
    alignClass: "items-end justify-start",
    border: "border-r",
    padding: "pt-8 px-8 pb-52",
  },
  "bottom-right": {
    arrow: "↘",
    gridClass: "col-start-2 row-start-2",
    alignClass: "items-end justify-end",
    border: "",
    padding: "pt-8 px-8 pb-52",
  },
};

export default function CalibrationScreen() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const overlayRef = useRef<HandOverlay | null>(null);
  const [step, setStep] = useState<CalibrationStep>("setup");
  const [cameraError, setCameraError] = useState(false);
  const [hitQuadrants, setHitQuadrants] = useState<Set<Quadrant>>(new Set());

  useEffect(() => {
    async function startCamera() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: "user",
            width: { ideal: 640 },
            height: { ideal: 480 },
          },
        });
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
        }
      } catch {
        setCameraError(true);
      }
    }
    startCamera();

    return () => {
      overlayRef.current?.stop();
      streamRef.current?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  async function handleReady() {
    setStep("loading");
    try {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      if (!video || !canvas) {
        setStep("done");
        return;
      }
      const overlay = new HandOverlay(video, canvas, { onPunch: handlePunch });
      overlayRef.current = overlay;
      await overlay.init();
      overlay.start();
      setStep("hitting");
    } catch {
      // Model failed to load — skip straight to done
      setStep("done");
    }
  }

  function handlePunch(quadrant: Quadrant) {
    setHitQuadrants((prev) => {
      const next = new Set(prev);
      next.add(quadrant);
      if (next.size === ALL_QUADRANTS.length) {
        setTimeout(() => setStep("done"), 600);
      }
      return next;
    });
  }

  function handleFinish() {
    saveCalibration({ calibratedAt: Date.now() });
    stopAll();
    const dest = calibrationReturnTo.value;
    calibrationReturnTo.value = "playing";
    screen.value = dest;
  }

  function handleSkip() {
    saveCalibration({ calibratedAt: Date.now() });
    stopAll();
    const dest = calibrationReturnTo.value;
    calibrationReturnTo.value = "playing";
    screen.value = dest;
  }

  function stopAll() {
    overlayRef.current?.stop();
    streamRef.current?.getTracks().forEach((t) => t.stop());
  }

  if (cameraError) {
    return (
      <div class="h-screen flex flex-col items-center justify-center bg-indigo-950 px-6 text-center">
        <div class="text-6xl mb-4">📷</div>
        <h2 class="text-2xl font-bold text-white mb-3">Camera not available</h2>
        <p class="text-white/60 mb-6 max-w-sm">
          No worries — you can still play using keyboard or touch controls.
        </p>
        <button
          type="button"
          onClick={() => {
            saveCalibration({
              calibratedAt: Date.now(),
              noCamera: true,
            });
            const dest = calibrationReturnTo.value;
            calibrationReturnTo.value = "playing";
            screen.value = dest;
          }}
          class="px-8 py-3 bg-yellow-400 hover:bg-yellow-300 text-slate-900 font-bold rounded-xl transition-all"
        >
          Continue without camera
        </button>
      </div>
    );
  }

  return (
    <div class="screen-container bg-indigo-950">
      {/* Full-screen camera feed */}
      <video
        ref={videoRef}
        class="overlay-fill object-cover video-mirror opacity-70"
        muted
        playsInline
        autoPlay
      />
      <canvas
        ref={canvasRef}
        class="overlay-fill video-mirror pointer-events-none"
      />

      {/* Quadrant targets — full-screen grid so corners align with actual hit zones */}
      {step === "hitting" && (
        <div class="absolute inset-0 grid grid-cols-2 grid-rows-2 pointer-events-none">
          {ALL_QUADRANTS.map((q) => {
            const meta = QUADRANT_META[q];
            const hit = hitQuadrants.has(q);
            return (
              <div
                key={q}
                class={`${meta.gridClass} ${meta.border} border-white/15 flex ${meta.alignClass} ${meta.padding}`}
              >
                <div
                  class={`w-20 h-20 rounded-full border-2 flex items-center justify-center transition-all duration-300 ${
                    hit
                      ? "bg-green-500 border-green-400 scale-110"
                      : "bg-yellow-400/20 border-yellow-400 animate-pulse"
                  }`}
                >
                  {hit ? (
                    <span class="text-white text-3xl font-bold">✓</span>
                  ) : (
                    <span class="text-yellow-400 text-3xl">{meta.arrow}</span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Loading spinner overlay */}
      {step === "loading" && (
        <div class="absolute inset-0 flex items-center justify-center bg-black/40">
          <div class="text-center">
            <div class="w-14 h-14 border-4 border-yellow-400 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
            <p class="text-white font-semibold text-lg">
              Loading hand detection…
            </p>
          </div>
        </div>
      )}

      {/* Header */}
      <div class="absolute top-0 left-0 right-0 z-10 flex items-center justify-between px-6 pt-6 pb-3">
        <button
          type="button"
          onClick={handleSkip}
          class="text-white/60 hover:text-white text-sm transition-colors"
        >
          Skip calibration
        </button>
        <span class="text-white/60 text-sm">Camera Setup</span>
      </div>

      {/* Bottom panel — instructions + action */}
      <div class="absolute bottom-0 left-0 right-0 z-10 px-6 pb-8 pt-6 bg-gradient-to-t from-indigo-950/95 via-indigo-950/80 to-transparent">
        {step === "setup" && (
          <>
            <h2 class="text-xl font-bold text-white mb-1">Set up your space</h2>
            <p class="text-white/60 mb-5 text-sm">
              Stand back so your upper body is visible. Clear about an arm's
              length around you.
            </p>
            <div class="flex gap-3 text-sm text-slate-300 mb-5">
              <div class="flex-1 bg-white/10 rounded-xl p-3 text-center">
                <div class="text-xl mb-1">📏</div>
                <p class="text-xs">1–2m away</p>
              </div>
              <div class="flex-1 bg-white/10 rounded-xl p-3 text-center">
                <div class="text-xl mb-1">💡</div>
                <p class="text-xs">Good lighting</p>
              </div>
              <div class="flex-1 bg-white/10 rounded-xl p-3 text-center">
                <div class="text-xl mb-1">🧹</div>
                <p class="text-xs">Clear space</p>
              </div>
            </div>
            <button
              type="button"
              onClick={handleReady}
              class="w-full py-4 bg-yellow-400 hover:bg-yellow-300 text-slate-900 font-bold text-lg rounded-2xl transition-all active:scale-95"
            >
              I'm ready →
            </button>
          </>
        )}

        {step === "loading" && (
          <p class="text-white/60 text-center text-sm">
            Loading hand detection model…
          </p>
        )}

        {step === "hitting" && (
          <>
            <h2 class="text-xl font-bold text-white mb-1">Hit each corner!</h2>
            <p class="text-white/60 text-sm mb-4">
              Reach toward each glowing corner and hold for a moment to
              register.
            </p>
            <div class="flex gap-2">
              {ALL_QUADRANTS.map((q) => (
                <div
                  key={q}
                  class={`flex-1 h-2 rounded-full transition-all duration-300 ${
                    hitQuadrants.has(q) ? "bg-green-500" : "bg-white/20"
                  }`}
                />
              ))}
            </div>
            <p class="text-white/50 text-xs text-center mt-2">
              {hitQuadrants.size} / {ALL_QUADRANTS.length} corners hit
            </p>
          </>
        )}

        {step === "done" && (
          <>
            <h2 class="text-xl font-bold text-white mb-1">All set! 🎉</h2>
            <p class="text-white/60 text-sm mb-5">
              Hand detection is working. You're ready to play!
            </p>
            <button type="button" onClick={handleFinish} class="btn-primary">
              Let's play! 👊
            </button>
          </>
        )}
      </div>
    </div>
  );
}
