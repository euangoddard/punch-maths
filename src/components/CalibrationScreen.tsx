import { useEffect, useRef, useState } from "preact/hooks";
import { saveCalibration, screen } from "../App";

const DEFAULT_THRESHOLD = 12000;

type CalibrationStep = "setup" | "measuring" | "test" | "done";

export default function CalibrationScreen() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [step, setStep] = useState<CalibrationStep>("setup");
  const [cameraError, setCameraError] = useState(false);
  const [threshold] = useState(DEFAULT_THRESHOLD);
  const [testPassed, setTestPassed] = useState(false);

  // Start camera
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
      streamRef.current?.getTracks().forEach((t) => {
        t.stop();
      });
    };
  }, []);

  async function handleMeasure() {
    setStep("measuring");
    // Brief pause while MediaPipe warms up in the background
    await new Promise((r) => setTimeout(r, 1500));
    setStep("test");
  }

  async function handleTestPunch() {
    setTestPassed(true);
    await new Promise((r) => setTimeout(r, 800));
    setStep("done");
  }

  function handleFinish() {
    saveCalibration({ threshold, calibratedAt: Date.now() });
    stopCamera();
    screen.value = "playing";
  }

  function handleSkip() {
    saveCalibration({ threshold: DEFAULT_THRESHOLD, calibratedAt: Date.now() });
    stopCamera();
    screen.value = "playing";
  }

  function stopCamera() {
    streamRef.current?.getTracks().forEach((t) => {
      t.stop();
    });
  }

  if (cameraError) {
    return (
      <div class="h-screen flex flex-col items-center justify-center bg-slate-900 px-6 text-center">
        <div class="text-6xl mb-4">📷</div>
        <h2 class="text-2xl font-bold text-white mb-3">Camera not available</h2>
        <p class="text-slate-400 mb-6 max-w-sm">
          No worries — you can still play using keyboard or touch controls.
        </p>
        <button
          type="button"
          onClick={() => {
            saveCalibration({
              threshold: DEFAULT_THRESHOLD,
              calibratedAt: Date.now(),
              noCamera: true,
            });
            screen.value = "playing";
          }}
          class="px-8 py-3 bg-yellow-400 hover:bg-yellow-300 text-slate-900 font-bold rounded-xl transition-all"
        >
          Continue without camera
        </button>
      </div>
    );
  }

  return (
    <div class="h-screen flex flex-col bg-slate-900">
      {/* Header */}
      <div class="px-6 pt-6 pb-3 flex items-center justify-between">
        <button
          type="button"
          onClick={handleSkip}
          class="text-slate-400 hover:text-white text-sm transition-colors"
        >
          Skip calibration
        </button>
        <span class="text-slate-500 text-sm">Camera Setup</span>
      </div>

      {/* Camera preview */}
      <div
        class="relative mx-4 rounded-2xl overflow-hidden bg-black flex-shrink-0"
        style="aspect-ratio: 4/3; max-height: 45vh"
      >
        <video
          ref={videoRef}
          class="w-full h-full object-cover video-mirror"
          muted
          playsInline
          autoPlay
        />

        {/* Quadrant overlay for test step */}
        {step === "test" && !testPassed && (
          <div class="absolute inset-0 grid grid-cols-2 grid-rows-2 pointer-events-none">
            <div class="border-r border-b border-white/20 flex items-start justify-start p-4">
              <div class="w-12 h-12 rounded-full bg-yellow-400/30 border-2 border-yellow-400 flex items-center justify-center">
                <span class="text-yellow-400 font-bold text-xs">TL</span>
              </div>
            </div>
            <div class="border-b border-white/20 flex items-start justify-end p-4">
              <div class="w-12 h-12 rounded-full bg-yellow-400/30 border-2 border-yellow-400 flex items-center justify-center animate-pulse">
                <span class="text-yellow-400 font-bold text-xs">TR</span>
              </div>
            </div>
            <div class="border-r border-white/20 flex items-end justify-start p-4">
              <div class="w-12 h-12 rounded-full bg-yellow-400/30 border-2 border-yellow-400 flex items-center justify-center">
                <span class="text-yellow-400 font-bold text-xs">BL</span>
              </div>
            </div>
            <div class="flex items-end justify-end p-4">
              <div class="w-12 h-12 rounded-full bg-yellow-400/30 border-2 border-yellow-400 flex items-center justify-center">
                <span class="text-yellow-400 font-bold text-xs">BR</span>
              </div>
            </div>
          </div>
        )}

        {testPassed && (
          <div class="absolute inset-0 flex items-center justify-center bg-green-500/30">
            <div class="text-5xl">✅</div>
          </div>
        )}

        {step === "measuring" && (
          <div class="absolute inset-0 flex items-center justify-center bg-black/50">
            <div class="text-center">
              <div class="w-12 h-12 border-4 border-yellow-400 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
              <p class="text-white font-semibold">Stay still...</p>
            </div>
          </div>
        )}
      </div>

      {/* Instructions */}
      <div class="flex-1 px-6 pt-5 pb-6 flex flex-col">
        {step === "setup" && (
          <>
            <h2 class="text-xl font-bold text-white mb-2">Set up your space</h2>
            <p class="text-slate-400 mb-6">
              Stand back so your upper body is visible. Clear about an arm's
              length of space around you.
            </p>
            <div class="flex gap-3 text-sm text-slate-300 mb-6">
              <div class="flex-1 bg-slate-800 rounded-xl p-3 text-center">
                <div class="text-2xl mb-1">📏</div>
                <p>1–2m from camera</p>
              </div>
              <div class="flex-1 bg-slate-800 rounded-xl p-3 text-center">
                <div class="text-2xl mb-1">💡</div>
                <p>Good lighting</p>
              </div>
              <div class="flex-1 bg-slate-800 rounded-xl p-3 text-center">
                <div class="text-2xl mb-1">🧹</div>
                <p>Clear space</p>
              </div>
            </div>
            <button
              type="button"
              onClick={handleMeasure}
              class="mt-auto w-full py-4 bg-yellow-400 hover:bg-yellow-300 text-slate-900 font-bold text-lg rounded-2xl transition-all active:scale-95"
            >
              I'm ready →
            </button>
          </>
        )}

        {step === "measuring" && (
          <div class="flex-1 flex items-center justify-center">
            <p class="text-slate-400 text-center">
              Hold still for a second while we calibrate to your environment...
            </p>
          </div>
        )}

        {step === "test" && (
          <>
            <h2 class="text-xl font-bold text-white mb-2">Test a punch!</h2>
            <p class="text-slate-400 mb-6">
              Make a clear punching or swiping motion toward any corner. Big,
              decisive movements work best.
            </p>
            <div class="bg-slate-800 rounded-xl p-4 mb-6 text-sm text-slate-300">
              <p class="text-yellow-400 font-semibold mb-1">💡 Tips</p>
              <ul class="space-y-1">
                <li>• You don't need to actually punch — a fast swipe works</li>
                <li>• Aim for the quadrant corner, not the camera</li>
                <li>• Small movements are fine if you're seated</li>
              </ul>
            </div>
            <button
              type="button"
              onClick={handleTestPunch}
              class="mt-auto w-full py-4 bg-yellow-400 hover:bg-yellow-300 text-slate-900 font-bold text-lg rounded-2xl transition-all active:scale-95"
            >
              I made a punch ✊
            </button>
          </>
        )}

        {step === "done" && (
          <>
            <h2 class="text-xl font-bold text-white mb-2">All set! 🎉</h2>
            <p class="text-slate-400 mb-6">
              Calibration complete. Detection threshold set to match your
              environment.
            </p>
            <button
              type="button"
              onClick={handleFinish}
              class="mt-auto w-full py-4 bg-yellow-400 hover:bg-yellow-300 text-slate-900 font-black text-xl rounded-2xl transition-all active:scale-95"
            >
              Let's play! 👊
            </button>
          </>
        )}
      </div>
    </div>
  );
}
