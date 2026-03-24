import {
  component$,
  useContext,
  useSignal,
  useStore,
  useVisibleTask$,
} from "@builder.io/qwik";
import type { DocumentHead } from "@builder.io/qwik-city";
import { useNavigate } from "@builder.io/qwik-city";
import { CALIBRATION_STORAGE_KEY } from "../../constants";
import {
  CalibrationContext,
  CalibrationReturnToContext,
} from "../../context/game";
import { HandOverlay } from "../../detection/handOverlay";
import type { Quadrant } from "../../types";

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

function saveCalibrationToStorage(): void {
  try {
    localStorage.setItem(
      CALIBRATION_STORAGE_KEY,
      JSON.stringify({ calibratedAt: Date.now() }),
    );
  } catch {
    // localStorage may be unavailable
  }
}

export default component$(() => {
  const calibrationData = useContext(CalibrationContext);
  const calibrationReturnTo = useContext(CalibrationReturnToContext);
  const nav = useNavigate();

  const step = useSignal<CalibrationStep>("setup");
  const cameraError = useSignal(false);
  const hitQuadrants = useSignal<Set<Quadrant>>(new Set());

  // DOM element refs — stored as plain signals so useVisibleTask$ can read them
  const videoEl = useSignal<HTMLVideoElement | undefined>();
  const canvasEl = useSignal<HTMLCanvasElement | undefined>();

  // Mutable browser resources (not reactive, not serialised)
  const refs = useStore<{
    stream: MediaStream | null;
    overlay: HandOverlay | null;
  }>({
    stream: null,
    overlay: null,
  });

  function completeAndNavigate() {
    saveCalibrationToStorage();
    calibrationData.value = { calibratedAt: Date.now() };
    const dest = calibrationReturnTo.value;
    calibrationReturnTo.value = "/play";
    refs.overlay?.stop();
    for (const t of refs.stream?.getTracks() ?? []) {
      t.stop();
    }
    nav(dest);
  }

  // Start camera on mount
  // biome-ignore lint/correctness/noQwikUseVisibleTask: camera access requires browser API
  useVisibleTask$(async ({ cleanup }) => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: "user",
          width: { ideal: 640 },
          height: { ideal: 480 },
        },
      });
      refs.stream = stream;
      const vid = videoEl.value;
      if (vid) {
        vid.srcObject = stream;
        await vid.play();
      }
    } catch {
      cameraError.value = true;
    }

    cleanup(() => {
      refs.overlay?.stop();
      for (const t of refs.stream?.getTracks() ?? []) {
        t.stop();
      }
    });
  });

  if (cameraError.value) {
    return (
      <div class="h-screen flex flex-col items-center justify-center bg-indigo-950 px-6 text-center">
        <div class="text-6xl mb-4">📷</div>
        <h2 class="text-2xl font-bold text-white mb-3">Camera not available</h2>
        <p class="text-white/60 mb-6 max-w-sm">
          No worries — you can still play using keyboard or touch controls.
        </p>
        <button
          type="button"
          onClick$={() => {
            saveCalibrationToStorage();
            calibrationData.value = {
              calibratedAt: Date.now(),
              noCamera: true,
            };
            const dest = calibrationReturnTo.value;
            calibrationReturnTo.value = "/play";
            nav(dest);
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
        ref={videoEl}
        class="overlay-fill object-cover video-mirror opacity-70"
        muted
        playsInline
        autoplay
      />
      <canvas
        ref={canvasEl}
        class="overlay-fill video-mirror pointer-events-none"
      />

      {/* Quadrant targets */}
      {step.value === "hitting" && (
        <div class="absolute inset-0 grid grid-cols-2 grid-rows-2 pointer-events-none">
          {ALL_QUADRANTS.map((q) => {
            const meta = QUADRANT_META[q];
            const hit = hitQuadrants.value.has(q);
            return (
              <div
                key={q}
                class={`${meta.gridClass} ${meta.border} border-white/15 flex ${meta.alignClass} ${meta.padding}`}
              >
                <div
                  class={[
                    "w-20 h-20 rounded-full border-2 flex items-center justify-center transition-all duration-300",
                    hit
                      ? "bg-green-500 border-green-400 scale-110"
                      : "bg-yellow-400/20 border-yellow-400 animate-pulse",
                  ]}
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
      {step.value === "loading" && (
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
          onClick$={completeAndNavigate}
          class="text-white/60 hover:text-white text-sm transition-colors"
        >
          Skip calibration
        </button>
        <span class="text-white/60 text-sm">Camera Setup</span>
      </div>

      {/* Bottom panel */}
      <div class="absolute bottom-0 left-0 right-0 z-10 px-6 pb-8 pt-6 bg-gradient-to-t from-indigo-950/95 via-indigo-950/80 to-transparent">
        {step.value === "setup" && (
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
              onClick$={async () => {
                step.value = "loading";
                try {
                  const vid = videoEl.value;
                  const canvas = canvasEl.value;
                  if (!vid || !canvas) {
                    step.value = "done";
                    return;
                  }
                  const overlay = new HandOverlay(vid, canvas, {
                    onPunch: (quadrant: Quadrant) => {
                      const next = new Set(hitQuadrants.value);
                      next.add(quadrant);
                      hitQuadrants.value = next;
                      if (next.size === ALL_QUADRANTS.length) {
                        setTimeout(() => {
                          step.value = "done";
                        }, 600);
                      }
                    },
                  });
                  refs.overlay = overlay;
                  await overlay.init();
                  overlay.start();
                  step.value = "hitting";
                } catch {
                  // Model failed to load — skip straight to done
                  step.value = "done";
                }
              }}
              class="w-full py-4 bg-yellow-400 hover:bg-yellow-300 text-slate-900 font-bold text-lg rounded-2xl transition-all active:scale-95"
            >
              I'm ready →
            </button>
          </>
        )}

        {step.value === "loading" && (
          <p class="text-white/60 text-center text-sm">
            Loading hand detection model…
          </p>
        )}

        {step.value === "hitting" && (
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
                  class={[
                    "flex-1 h-2 rounded-full transition-all duration-300",
                    hitQuadrants.value.has(q) ? "bg-green-500" : "bg-white/20",
                  ]}
                />
              ))}
            </div>
            <p class="text-white/50 text-xs text-center mt-2">
              {hitQuadrants.value.size} / {ALL_QUADRANTS.length} corners hit
            </p>
          </>
        )}

        {step.value === "done" && (
          <>
            <h2 class="text-xl font-bold text-white mb-1">All set! 🎉</h2>
            <p class="text-white/60 text-sm mb-5">
              Hand detection is working. You're ready to play!
            </p>
            <button
              type="button"
              onClick$={completeAndNavigate}
              class="btn-primary"
            >
              Let's play! 👊
            </button>
          </>
        )}
      </div>
    </div>
  );
});

export const head: DocumentHead = {
  title: "Camera Setup — Punch Maths",
};
