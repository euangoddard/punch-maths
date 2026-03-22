# Punch Maths — Product Brief

## Concept

Punch Maths is a browser-based game that combines mental arithmetic with physical movement. Players see a maths question on screen alongside four possible answers, each positioned in a different quadrant. Using their webcam, they physically "punch" toward the quadrant containing the correct answer before a timer runs out. The system uses real-time motion detection to register their choice.

The result is a game that makes maths practice genuinely physical and engaging — part quiz, part workout, part party game.

---

## Core Gameplay Loop

1. A maths question appears at the centre of the screen (e.g. *"7 × 8"*).
2. Four answer options populate the four quadrants: top-left, top-right, bottom-left, bottom-right. One is correct; three are plausible distractors.
3. A countdown timer (configurable, default 5 seconds) begins.
4. The player punches, swipes, or moves their hand/arm toward the quadrant they believe is correct.
5. The webcam feed detects the direction and magnitude of motion to determine which quadrant was targeted.
6. Immediate feedback: correct answers trigger a satisfying hit animation and score increment; incorrect answers show the right answer with a brief explanation.
7. After a short pause, the next question loads.

A round consists of 10–20 questions. At the end, the player sees a summary: score, accuracy, average reaction time, and a streak tracker.

---

## Target Audience

The primary audiences are children aged 6–14 practising arithmetic, teachers and parents looking for engaging maths reinforcement tools, and casual/party gamers who enjoy physical browser games. A secondary audience includes adults using the game for cognitive warm-ups or physiotherapy-adjacent hand/arm exercises.

---

## Motion Detection: Technical Approach

### Recommended Stack

| Layer | Technology | Rationale |
|---|---|---|
| Camera access | `navigator.mediaDevices.getUserMedia()` | Native browser API, no plugins required |
| Pose/hand detection | **MediaPipe Hands** or **TensorFlow.js (MoveNet / HandPose)** | Client-side ML inference, no server round-trip, runs at 30fps on modern hardware |
| Motion vector analysis | Custom JS logic | Compare landmark positions across consecutive frames to derive direction and velocity of movement |
| Rendering | HTML Canvas or WebGL (via Three.js / PixiJS) | Hardware-accelerated visuals, compositing the camera feed with game UI |
| Audio | **Tone.js** or Web Audio API | Low-latency sound effects for hits, misses, and countdowns |
| State management | Vanilla JS / Zustand / Redux (if React) | Lightweight game state: score, timer, current question, difficulty |

### How Detection Works

The system runs a lightweight ML model (MediaPipe Hands is the strongest candidate — it provides 21 hand landmarks per frame at ~30fps on mid-range hardware) to track the player's hand in the webcam feed. Each frame, the system compares the current hand centroid position against the previous frame's to calculate a motion vector. When the magnitude of that vector exceeds a configurable "punch threshold" (i.e. the hand moved fast enough), the direction of the vector determines which quadrant was targeted.

Key considerations:

- **Debouncing**: After a punch is registered, impose a short cooldown (~500ms) to prevent accidental double-registrations.
- **Calibration phase**: On first play, a brief calibration step asks the player to punch toward each quadrant so the system can map their range of motion to screen coordinates.
- **Fallback input**: Always provide keyboard/touch fallback (arrow keys, tapping quadrants) for accessibility and for devices without cameras.

### Alternative Detection Approaches

If MediaPipe proves too heavy for the target device range, simpler approaches can substitute:

- **Frame-differencing**: Compare pixel brightness between consecutive frames to detect bulk motion direction. Much cheaper computationally but less precise — better suited to large, dramatic arm movements than subtle hand gestures.
- **Colour tracking**: Ask the player to wear a brightly coloured glove or hold a coloured object. Track that colour blob's centroid across frames. Very fast, very reliable, but requires a prop.
- **WebXR Hand Tracking**: For devices that support it (e.g. Meta Quest Browser), use the WebXR Hand Tracking API for sub-millimetre precision. This is the gold-standard experience but limits the audience to XR headset owners.

---

## Maths Engine

### Question Generation

Questions should be generated client-side using parameterised templates rather than pulled from a static bank. This allows infinite variety and smooth difficulty scaling.

**Difficulty tiers:**

| Tier | Operations | Number range | Example |
|---|---|---|---|
| 1 — Starter | Addition, subtraction | 1–20 | 8 + 5 = ? |
| 2 — Intermediate | Multiplication, simple division | 1–12 tables | 7 × 9 = ? |
| 3 — Advanced | Mixed operations, larger numbers | Up to 100 | 48 ÷ 6 = ? |
| 4 — Challenge | Order of operations, fractions, percentages | Mixed | 25% of 80 = ? |
| 5 — Expert | Squares, square roots, negative numbers | Mixed | √144 = ? |

### Distractor Generation

Good distractors are critical to the game feeling fair. They should be *plausible wrong answers*, not random numbers. Strategies include: applying the correct operation to adjacent numbers (e.g. for 7 × 8, offer 7 × 7 = 49 and 7 × 9 = 63), off-by-one/two errors, common misconception answers (e.g. for 6 + 4 × 3, offer 30 as the "left-to-right" trap), and reversals of digits (e.g. 54 instead of 45).

---

## Technology Stack — Full Recommendation

| Concern | Choice | Notes |
|---|---|---|
| **Framework** | **SvelteKit** or **Next.js (React)** | Svelte has excellent performance characteristics for games; React has a larger ecosystem and is easier to hire for |
| **Motion detection** | **MediaPipe Hands** (primary), frame-differencing (fallback) | Load MediaPipe asynchronously; fall back gracefully |
| **Rendering** | **HTML Canvas** for game area, standard DOM for menus/UI | Canvas gives fine-grained control over compositing camera feed + game elements |
| **Audio** | **Tone.js** | Synth-generated effects keep the bundle small |
| **Hosting** | **Vercel** or **Cloudflare Pages** | Static-first deployment, edge CDN, zero cold starts |
| **Analytics** | **Plausible** or **PostHog** | Privacy-friendly; track session length, scores, drop-off points |
| **Backend (optional)** | **Supabase** or **Firebase** | Only needed if adding leaderboards, accounts, or teacher dashboards |

The entire core game can run as a purely client-side static site with no backend dependency. A backend only becomes necessary for persistent accounts, leaderboards, or teacher analytics.

---

## Game Modes & Variations

### Core Modes

**Classic**: 10 questions, fixed difficulty, individual play. The baseline experience.

**Time Attack**: Unlimited questions in 60/90/120 seconds. Correct answers add time (+2s); wrong answers subtract it (−1s). Tests speed and accuracy under pressure.

**Survival**: Three lives. Each wrong answer costs a life. Questions get progressively harder. How far can you get?

**Zen Mode**: No timer, no score. Just practice. Ideal for younger children or anxiety-free revision.

### Multiplayer Variations

**Split Screen (Local)**: Two players stand side by side, each tracked by the same webcam but on different halves of the screen. Same question, race to punch first. Requires the detection system to distinguish two separate hands/people — feasible with MediaPipe's multi-hand tracking.

**Pass & Play**: Players take turns on the same device. Scores are compared at the end.

**Remote Duel (Networked)**: Two players on separate devices answer the same sequence of questions simultaneously. Implemented via WebSockets (e.g. Socket.io or Ably) with a shared question seed. Lower motion-detection latency concerns since each player's detection is local.

### Thematic Variations

**Boss Battles**: Every 5th question is a "boss" — a harder question with a dramatic visual treatment. Defeating the boss unlocks a cosmetic reward.

**Story Mode**: A light narrative wrapper where the player progresses through themed "worlds" (e.g. a jungle level for multiplication, an ocean level for division). Each world has 10 stages of increasing difficulty.

**Daily Challenge**: A fixed sequence of 10 questions that's the same for every player that day. A global leaderboard ranks scores. Encourages daily return visits.

---

## Accessibility & Inclusion

Accessibility is not optional — it's a first-class design concern.

- **Keyboard/touch fallback** for every interaction. No feature should be camera-exclusive.
- **Colour-blind safe palettes** for quadrant differentiation (use shape/icon indicators alongside colour).
- **Screen reader announcements** for question text, answer options, and results via ARIA live regions.
- **Adjustable timers** including a "no timer" option.
- **Motion sensitivity settings**: Adjustable punch threshold so players with limited mobility can still trigger detection with smaller movements.
- **Seated play**: The calibration phase should adapt to seated players whose range of motion is narrower.

---

## Monetisation Options (If Applicable)

If the game moves beyond a free tool:

- **Freemium**: Core game free; premium unlocks additional modes (Story Mode, Daily Challenge leaderboards), cosmetic themes, and teacher dashboard features.
- **School/Institutional Licensing**: Bulk licenses for schools that include a teacher dashboard with per-student analytics (accuracy by topic, time-on-task, progress over time).
- **Cosmetic Shop**: Purchasable visual themes, punch effects, avatar customisation. No gameplay advantage.
- **Ad-supported free tier**: Interstitial ads between rounds (not during gameplay).

---

## Success Metrics

| Metric | Target | Measurement |
|---|---|---|
| Session length | > 5 minutes average | Analytics |
| Return rate | > 30% D7 retention | Analytics |
| Accuracy improvement | Measurable score increase over 10 sessions per user | Per-user score tracking |
| Webcam opt-in rate | > 60% of sessions use camera | Feature flag tracking |
| Fallback usage | < 40% of sessions rely solely on keyboard/touch | Feature flag tracking |
| Latency (punch → feedback) | < 200ms | Performance monitoring |

---

## Risks & Mitigations

| Risk | Impact | Mitigation |
|---|---|---|
| Camera permission refusal | Player can't use core mechanic | Keyboard/touch fallback is always available and fully functional |
| Low-end device performance | ML model drops frames, detection unreliable | Frame-differencing fallback; adaptive quality settings; test on budget Chromebooks |
| Privacy concerns (webcam) | Players/parents reluctant to enable camera | All processing is client-side — no video data ever leaves the browser. Communicate this clearly in onboarding |
| Lighting variation | Poor detection in dim or backlit rooms | MediaPipe is reasonably robust; add a "lighting check" to calibration that warns if conditions are poor |
| Physical safety | Players punch too hard / hit objects | Onboarding screen: "Clear space around you." In-game, small movements are sufficient — communicate this during calibration |
| Cheating (multiplayer) | Players use keyboard while others use camera | Separate leaderboards for input methods; or accept it — the physical experience *is* the game |

---

## MVP Scope

A minimum viable product covers the following:

1. Webcam-based motion detection using MediaPipe Hands with keyboard fallback.
2. Question engine covering Tiers 1–3 (addition through division) with intelligent distractor generation.
3. Classic mode (10 questions, single player).
4. Time Attack mode.
5. Score summary screen with accuracy and average reaction time.
6. Calibration flow on first play.
7. Mobile-responsive layout with touch input for phones/tablets.
8. No backend — fully static, deployable to any CDN.

Everything beyond this (multiplayer, story mode, leaderboards, teacher dashboards) is Phase 2+.

---

## Development Estimate

| Phase | Scope | Estimated effort |
|---|---|---|
| **Phase 1 — MVP** | Detection, question engine, Classic + Time Attack, summary screen | 4–6 weeks (1 developer) |
| **Phase 2 — Polish** | Sound design, animations, Survival + Zen modes, accessibility audit | 2–3 weeks |
| **Phase 3 — Social** | Leaderboards, Daily Challenge, remote multiplayer | 3–4 weeks |
| **Phase 4 — Education** | Teacher dashboard, student accounts, curriculum alignment, school licensing | 4–6 weeks |

---

## Summary

Punch Maths sits at the intersection of edtech and physical gaming — a space that's underexplored in the browser. The technical foundations (client-side ML via MediaPipe, Canvas rendering, Web Audio) are mature enough to deliver a responsive, satisfying experience without any server infrastructure for the core game. The design space is rich: difficulty scaling, multiplayer variants, and thematic wrappers give the product long legs beyond an initial novelty factor.

The key bet is that making maths practice *physical* — not just gamified — creates a qualitatively different level of engagement. If the motion detection feels snappy and the feedback loop is tight, this could become a staple in classrooms and living rooms alike.
