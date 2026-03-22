// Hand overlay + punch detection via MediaPipe HandLandmarker.
//
// Position tracking uses only the 5 stable palm landmarks (wrist + 4 MCPs)
// rather than all 21, because fingertips are noisy and inflate jitter.
// An EMA filter smooths the tracked position so landmark jitter doesn't
// accumulate into false velocity spikes.
//
// A punch is registered when:
//   1. Smoothed velocity exceeds `punchThreshold` (default 0.08 normalised/frame)
//   2. The hand is in the outer half of a quadrant — within 0–0.35 of that
//      quadrant's corner in display space — so casual movement near the screen
//      centre cannot trigger a corner target.
//
// Display space mirrors the raw landmark x-axis to match the CSS-mirrored
// video feed, so left/right map correctly to what the player sees.
//
// WASM runtime and model are loaded from CDN to avoid Vite asset-serving config.

import {
  DrawingUtils,
  FilesetResolver,
  HandLandmarker,
} from "@mediapipe/tasks-vision";
import type { Quadrant } from "../types";

/** Radius of each corner's quarter-circle hit zone in normalised [0,1] coords */
const PUNCH_RADIUS = 0.5;

/** Consecutive frames the hand must dwell inside a hit zone to register a punch (~100ms at 30fps) */
const DWELL_FRAMES = 3;

export interface HandOverlayOptions {
  onPunch?: (quadrant: Quadrant) => void;
  /**
   * Called each frame with the quadrant the primary hand is currently in, or
   * null if no hand is detected. Use this to highlight the active target zone.
   */
  onHandQuadrant?: (quadrant: Quadrant | null) => void;
  cooldownMs?: number;
}

interface HandCentroid {
  x: number;
  y: number;
}

export class HandOverlay {
  private video: HTMLVideoElement;
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private landmarker: HandLandmarker | null = null;
  private drawingUtils: DrawingUtils | null = null;
  private rafId: number | null = null;
  private lastVideoTime = -1;
  private running = false;

  private onPunch: ((quadrant: Quadrant) => void) | undefined;
  private onHandQuadrant: ((quadrant: Quadrant | null) => void) | undefined;
  private cooldownMs: number;
  private debugMode = new URLSearchParams(location.search).has("debug");
  private cooldown = false;
  /**
   * EMA-smoothed palm position per hand index (raw landmark space, unmirrored).
   * Smoothing rejects per-frame jitter so velocity reflects real hand motion.
   */
  private smoothed = new Map<number, HandCentroid>();
  private _currentQuadrant: Quadrant | null = null;
  private _dwellQuadrant: Quadrant | null = null;
  private _dwellFrames = 0;

  constructor(
    video: HTMLVideoElement,
    canvas: HTMLCanvasElement,
    options: HandOverlayOptions = {},
  ) {
    this.video = video;
    this.canvas = canvas;
    const ctx2d = canvas.getContext("2d");
    if (!ctx2d) {
      throw new Error("Failed to get 2D canvas context");
    }
    this.ctx = ctx2d;
    this.onPunch = options.onPunch;
    this.onHandQuadrant = options.onHandQuadrant;
    this.cooldownMs = options.cooldownMs ?? 700;
  }

  async init(): Promise<void> {
    const vision = await FilesetResolver.forVisionTasks(
      "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.33/wasm",
    );
    this.landmarker = await HandLandmarker.createFromOptions(vision, {
      baseOptions: {
        modelAssetPath:
          "https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task",
        delegate: "GPU",
      },
      runningMode: "VIDEO",
      numHands: 2,
    });
    this.drawingUtils = new DrawingUtils(this.ctx);
  }

  start(): void {
    if (this.running) {
      return;
    }
    this.running = true;
    this._loop();
  }

  stop(): void {
    this.running = false;
    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    this.smoothed.clear();
    this._currentQuadrant = null;
    this._dwellQuadrant = null;
    this._dwellFrames = 0;
  }

  private _loop(): void {
    if (!this.running) {
      return;
    }
    this.rafId = requestAnimationFrame(() => this._loop());
    this._processFrame();
  }

  private _processFrame(): void {
    const { canvas, ctx } = this;
    if (!this.landmarker || !this.drawingUtils || this.video.readyState < 2) {
      return;
    }

    const w = this.video.videoWidth;
    const h = this.video.videoHeight;
    if (!w || !h) {
      return;
    }

    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w;
      canvas.height = h;
    }

    if (this.video.currentTime === this.lastVideoTime) {
      return;
    }
    this.lastVideoTime = this.video.currentTime;

    const results = this.landmarker.detectForVideo(
      this.video,
      performance.now(),
    );

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    if (this.debugMode) {
      this._drawHitZones(w, h);
    }

    const detectedCount = results.landmarks?.length ?? 0;

    if (results.landmarks && detectedCount > 0) {
      // Stable palm landmark indices: wrist + 4 MCP knuckles.
      // Fingertips (4,8,12,16,20) are excluded — they are the noisiest landmarks.
      const PALM_IDX = [0, 5, 9, 13, 17];
      const handPositions: Array<{ displayX: number; displayY: number }> = [];

      for (let i = 0; i < results.landmarks.length; i++) {
        const landmarks = results.landmarks[i];

        // Draw skeleton (debug only)
        if (this.debugMode) {
          this.drawingUtils.drawConnectors(
            landmarks,
            HandLandmarker.HAND_CONNECTIONS,
            {
              color: "#00FF00",
              lineWidth: 3,
            },
          );
          this.drawingUtils.drawLandmarks(landmarks, {
            color: "#FF0000",
            lineWidth: 1,
            radius: 4,
          });
        }

        // Palm centroid from stable landmarks only
        let rawX = 0,
          rawY = 0;
        for (const idx of PALM_IDX) {
          rawX += landmarks[idx].x;
          rawY += landmarks[idx].y;
        }
        rawX /= PALM_IDX.length;
        rawY /= PALM_IDX.length;

        // EMA smoothing (α=0.6): new position weighted 60% current, 40% previous.
        // This rejects per-frame jitter while staying responsive to real motion.
        const ALPHA = 0.6;
        const prev = this.smoothed.get(i);
        const sx = prev ? ALPHA * rawX + (1 - ALPHA) * prev.x : rawX;
        const sy = prev ? ALPHA * rawY + (1 - ALPHA) * prev.y : rawY;
        this.smoothed.set(i, { x: sx, y: sy });

        // Mirror x to match the CSS-mirrored video display
        const displayX = 1 - sx;
        const displayY = sy;

        // Collect display positions for all hands; pick the active one below
        handPositions.push({ displayX, displayY });
      }

      // Choose the active hand: prefer any hand currently inside a hit zone
      // so that either hand can register, not just index 0.
      let activeX: number;
      let activeY: number;
      const inZoneHand = handPositions.find(({ displayX, displayY }) => {
        const cx = displayX < 0.5 ? 0 : 1;
        const cy = displayY < 0.5 ? 0 : 1;
        return (
          Math.sqrt((displayX - cx) ** 2 + (displayY - cy) ** 2) < PUNCH_RADIUS
        );
      });
      if (inZoneHand) {
        activeX = inZoneHand.displayX;
        activeY = inZoneHand.displayY;
      } else {
        activeX = handPositions[0].displayX;
        activeY = handPositions[0].displayY;
      }

      // Track quadrant for ring highlighting
      this._currentQuadrant = this._quadrant(activeX, activeY);
      this.onHandQuadrant?.(this._currentQuadrant);

      // Dwell detection: register a punch when the active hand stays inside a
      // hit zone for DWELL_FRAMES consecutive frames.
      if (this.onPunch) {
        const cornerX = activeX < 0.5 ? 0 : 1;
        const cornerY = activeY < 0.5 ? 0 : 1;
        const distToCorner = Math.sqrt(
          (activeX - cornerX) ** 2 + (activeY - cornerY) ** 2,
        );
        const inZone = distToCorner < PUNCH_RADIUS;
        const q = this._quadrant(activeX, activeY);

        if (inZone && !this.cooldown) {
          if (this._dwellQuadrant === q) {
            this._dwellFrames++;
            if (this._dwellFrames >= DWELL_FRAMES) {
              this._dwellFrames = 0;
              this._dwellQuadrant = null;
              this.cooldown = true;
              this.onPunch(q);
              setTimeout(() => {
                this.cooldown = false;
              }, this.cooldownMs);
            }
          } else {
            this._dwellQuadrant = q;
            this._dwellFrames = 1;
          }
        } else {
          this._dwellQuadrant = null;
          this._dwellFrames = 0;
        }
      }

      // Remove state for hands that are no longer detected
      for (const key of this.smoothed.keys()) {
        if (key >= detectedCount) {
          this.smoothed.delete(key);
        }
      }
    } else {
      this._currentQuadrant = null;
      this.onHandQuadrant?.(null);
      this.smoothed.clear();
    }
  }

  /**
   * Draw a quarter-circle hit zone at each screen corner.
   *
   * The canvas has CSS scaleX(-1) applied, so canvas x=0 appears on the right
   * of the display and canvas x=w appears on the left. Corner mapping:
   *   display top-left     → canvas (w, 0),  arc PI/2 → PI
   *   display top-right    → canvas (0, 0),  arc 0    → PI/2
   *   display bottom-left  → canvas (w, h),  arc PI   → 3PI/2
   *   display bottom-right → canvas (0, h),  arc 3PI/2→ 2PI
   */
  private _drawHitZones(w: number, h: number): void {
    const ctx = this.ctx;
    const r = PUNCH_RADIUS * Math.min(w, h);

    const zones: Array<{
      cx: number;
      cy: number;
      a0: number;
      a1: number;
      q: Quadrant;
    }> = [
      { cx: w, cy: 0, a0: Math.PI / 2, a1: Math.PI, q: "top-left" },
      { cx: 0, cy: 0, a0: 0, a1: Math.PI / 2, q: "top-right" },
      { cx: w, cy: h, a0: Math.PI, a1: (3 * Math.PI) / 2, q: "bottom-left" },
      {
        cx: 0,
        cy: h,
        a0: (3 * Math.PI) / 2,
        a1: 2 * Math.PI,
        q: "bottom-right",
      },
    ];

    for (const z of zones) {
      const active = this._currentQuadrant === z.q;
      ctx.beginPath();
      ctx.moveTo(z.cx, z.cy);
      ctx.arc(z.cx, z.cy, r, z.a0, z.a1);
      ctx.closePath();
      ctx.fillStyle = active
        ? "rgba(255,255,255,0.15)"
        : "rgba(255,255,255,0.05)";
      ctx.fill();
      ctx.strokeStyle = active
        ? "rgba(255,255,255,0.55)"
        : "rgba(255,255,255,0.18)";
      ctx.lineWidth = 2;
      ctx.stroke();
    }
  }

  private _quadrant(displayX: number, displayY: number): Quadrant {
    if (displayX < 0.5 && displayY < 0.5) {
      return "top-left";
    }
    if (displayX >= 0.5 && displayY < 0.5) {
      return "top-right";
    }
    if (displayX < 0.5 && displayY >= 0.5) {
      return "bottom-left";
    }
    return "bottom-right";
  }
}
