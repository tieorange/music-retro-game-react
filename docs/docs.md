# PixelBeat — AI Agent Onboarding Guide

## What Is This Project?

**PixelBeat** is a web-based rhythm game. Users upload any audio file (MP3, WAV, OGG, M4A), the app analyzes beats using web-audio-beat-detector, then presents a rhythm game where notes fall toward a hit zone synced to the detected beats. Players tap keys (D/F/J/K for 4 lanes) to hit notes with timing-based scoring (Perfect/Great/Good/Miss), combo multipliers, and a final grade.

The visual style is retro pixel art fused with neon cyberpunk/synthwave — CRT scanlines, bloom, particle explosions, screen shake, and a music-reactive frequency visualizer.

---

## Tech Stack

| Technology | Purpose | Version |
|-----------|---------|---------|
| **Vite** | Build tool | ^6.0 |
| **React 18** | UI layer (menus, upload, results, overlays) | ^18.3 |
| **TypeScript** | Strict mode, no `any` | ^5.6 |
| **PixiJS v8** | Game canvas (notes, particles, effects) — **imperative API, NOT @pixi/react** | ^8.6 |
| **pixi-filters** | CRT scanlines, bloom effects | ^6.1 |
| **Tone.js** | Audio playback, precise scheduling, Transport system | ^15.0 |
| **web-audio-beat-detector** | Beat detection / BPM analysis | ^8.2.12 |
| **Zustand** | Global state management (bridges React ↔ PixiJS) | ^5.0 |
| **TailwindCSS v4** | Utility-first CSS for UI components | ^4.0 |
| **shadcn/ui** | Pre-built UI components (buttons, cards, etc.) | latest |
| **framer-motion** | UI transitions and animations | ^11.0 |
| **lucide-react** | Icons | ^0.400 |
| **nanoid** | Unique ID generation | ^5.0 |

---

## Architecture

### Core Principle: React + PixiJS Separation

React and PixiJS are **completely separate rendering systems** connected through Zustand:

```
React (DOM)                    PixiJS (Canvas)
├── Upload screen              ├── Lanes
├── Analyzing screen           ├── Falling notes
├── Results screen             ├── Hit zone
├── Pause/Countdown overlays   ├── Particles
├── HUD text overlays          ├── Frequency visualizer
└── reads/writes Zustand       └── reads Zustand, writes via engine
```

**Why not @pixi/react?** It targets React 19 and adds reconciliation overhead. A rhythm game needs frame-precise control — PixiJS runs imperatively via `useRef` + `useEffect` and reads state from Zustand each frame.

### Audio Sync Chain (CRITICAL)

This is the most important architectural detail. All timing flows through Tone.js:

```
1. web-audio-beat-detector (offline)
   └── Analyzes full audio → outputs beat timestamps + BPM

2. Tone.js Transport (real-time, sample-accurate)
   └── Schedules callbacks at each beat timestamp
   └── Tone.Draw bridges audio-time to animation frame

3. Zustand Store
   └── Updated via Tone.Draw callbacks (safe for state changes)

4. PixiJS Ticker (60fps)
   └── Reads Zustand state each frame
   └── Positions notes based on Transport.seconds
```

**NEVER use `performance.now()` or `Date.now()` for gameplay timing.** Always use `Tone.getTransport().seconds`. This ensures audio-visual sync.

### Folder Structure

```
src/
├── app/                           # Root providers, router
│   ├── providers.tsx
│   └── router.tsx                 # Phase-based: idle→analyzing→ready→playing→results
├── features/                      # Feature-sliced, isolated modules
│   ├── song-upload/               # Drag-drop, file decode
│   ├── beat-analysis/             # web-audio-beat-detector, beatmap generation
│   ├── gameplay/                  # THE CORE — engine, scene, input, scoring, effects
│   │   ├── engine/                # GameEngine, NoteScheduler, NoteTracker
│   │   ├── input/                 # InputManager (keyboard/touch)
│   │   ├── scoring/               # ScoringEngine, ComboTracker
│   │   ├── scene/                 # PixiJS renderers (notes, lanes, HUD, etc.)
│   │   └── effects/               # Particles, CRT, bloom, shake
│   ├── results/                   # Grade display, stats, high scores
│   └── shared-ui/                 # Layout, NeonText, RetroButton
├── domain/                        # Pure types and constants (NO dependencies)
│   ├── types.ts                   # Song, Note, BeatMap, GameScore, GameState, etc.
│   └── constants.ts               # Timing windows, combos, grades, lane config
├── infrastructure/                # External service adapters
│   ├── audio/                     # audioDecoder.ts, audioPlayback.ts
│   ├── analysis/                  # beatAnalysisService.ts
│   └── storage/                   # highScoreRepository.ts (localStorage)
├── shared/                        # Cross-cutting
│   ├── stores/gameStore.ts        # Zustand store — THE central state
│   ├── hooks/
│   └── utils/
├── lib/                           # Third-party wrappers
│   └── pixi/                      # PixiApp.ts, usePixiApp.ts
└── components/ui/                 # shadcn/ui generated components
```

---

## Key Domain Types

All defined in `src/domain/types.ts`:

- **`Song`** — `{ id, name, file, audioBuffer, duration }`
- **`Note`** — `{ id, time (seconds), lane (0-3), type }`
- **`BeatMap`** — `{ songId, bpm, notes[] }`
- **`HitJudgment`** — `'perfect' | 'great' | 'good' | 'miss'`
- **`HitResult`** — `{ noteId, judgment, delta (ms), comboAtHit }`
- **`GameScore`** — Full scoring record with accuracy, grade, combo stats
- **`GamePhase`** — State machine: `idle → analyzing → ready → countdown → playing → paused → results`
- **`GameState`** — Everything in the Zustand store

### Key Constants (`src/domain/constants.ts`)

- Timing windows: Perfect ±30ms, Great ±70ms, Good ±120ms
- Combo → multiplier: 10→x2, 30→x4, 50→x8
- Score values: Perfect=300, Great=200, Good=100, Miss=0
- Grades: S≥95%, A≥85%, B≥70%, C<70%
- Lane keys: D, F, J, K
- Note fall duration: 2.0 seconds

---

## How the Game Loop Works

```
EACH FRAME (via PixiJS Ticker):
1. Read currentTime = Tone.getTransport().seconds
2. GameEngine.update(currentTime)
   └── NoteTracker updates active/upcoming/passed notes
   └── Detect auto-misses for notes past the hit zone
3. NoteRenderer.update(currentTime, activeNotes)
   └── For each active note: y = lerp(spawnY, hitZoneY, progress)
   └── progress = 1 - (note.time - currentTime) / FALL_DURATION
4. ParticleSystem.update(deltaTime)
5. FilterManager.update(currentTime) — animate CRT
6. HUDRenderer.update(score, combo, multiplier)

ON KEYPRESS:
1. InputManager captures key → maps to lane
2. Reads Tone.getTransport().seconds for timing
3. GameEngine.handleInput(lane, time)
4. NoteTracker finds closest active note in that lane
5. ScoringEngine judges timing → HitJudgment
6. ComboTracker updates combo/multiplier
7. Store updated → triggers visual feedback (particles, judgment text, lane flash)
```

---

## Beat Analysis Details

The beat analysis uses the **web-audio-beat-detector** library:

- Uses internally managed Web Workers to avoid blocking the UI
- Runs a tempo guessing algorithm to find the BPM and calculates timestamps based on duration, offset, and tempo
- Implemented as a fallback from Essentia.js WASM due to Vite/Emscripten compilation complexities

**If beat detection fails:** Generate evenly-spaced beats at a guessed BPM as last resort.

---

## Zustand Store Structure

The store at `src/shared/stores/gameStore.ts` is the **single source of truth**:

```typescript
interface GameState {
  // Navigation
  phase: GamePhase;

  // Audio data
  song: Song | null;
  beatMap: BeatMap | null;

  // Live gameplay (updated every frame)
  currentTime: number;
  combo: number;
  multiplier: number;        // 1, 2, 4, or 8
  score: number;
  hitResults: HitResult[];

  // Post-game
  finalScore: GameScore | null;
  highScores: GameScore[];

  // Actions
  setSong(song: Song): void;
  setBeatMap(beatMap: BeatMap): void;
  setPhase(phase: GamePhase): void;
  addHitResult(result: HitResult): void;
  reset(): void;
  // ... etc
}
```

---

## PixiJS Integration Pattern

PixiJS runs **imperatively** inside React:

```typescript
// usePixiApp.ts
function usePixiApp(containerRef: RefObject<HTMLDivElement>) {
  useEffect(() => {
    const canvas = document.createElement('canvas');
    containerRef.current?.appendChild(canvas);
    const app = new Application();
    app.init({ canvas, width: 800, height: 600, antialias: false });
    // ... set up scene, ticker
    return () => app.destroy(true);
  }, []);
}
```

The GameScene creates sub-renderers (LaneRenderer, NoteRenderer, etc.) and adds them to the stage. The PixiJS Ticker drives updates at 60fps.

---

## How to Continue Building

### Implementation order (follow this exactly):

1. **Phase 1: Scaffolding** — Vite setup, all deps, folder structure, types, store, basic App
2. **Phase 2: Upload** — Drag-drop UI, audio decode
3. **Phase 3: Analysis** — Beat analysis, beatmap generation
4. **Phase 4: Engine** — Tone.js playback, note scheduling, game loop
5. **Phase 5: Visuals** — PixiJS scene, falling notes, hit zone
6. **Phase 6: Input** — Keyboard handling, scoring, combos
7. **Phase 7: Effects** — CRT, bloom, particles, shake, visualizer
8. **Phase 8: Flow** — Results screen, high scores, countdown, pause
9. **Phase 9: Polish** — Responsive, mobile, calibration, error handling

See `plan.md` for the full detailed plan with file lists, code examples, and verification steps for each phase.

### Rules for AI agents:

1. **Read `plan.md` first** — it contains the complete implementation plan
2. **Follow the phase order** — each phase builds on the previous
3. **Use strict TypeScript** — no `any`, no implicit returns, no unused variables
4. **Small focused files** — each file does one thing
5. **Barrel exports** — every folder gets an `index.ts`
6. **Never use @pixi/react** — PixiJS is imperative only
7. **Never use performance.now() for game timing** — only `Tone.getTransport().seconds`
8. **Object pool sprites** — never create/destroy sprites during gameplay
9. **Update Zustand from Tone.Draw callbacks** — not from Transport callbacks directly
10. **Keep domain/ pure** — no imports from features/ or infrastructure/
11. **Press Start 2P** is the pixel font for everything
12. **Test each phase** before moving to the next

### Commands

```bash
npm run dev     # Start dev server
npm run build   # Production build
npm run preview # Preview production build
```

---

## Visual Style Reference

- **Colors:** Dark background (#0a0a1a), neon cyan (#00ffff), magenta (#ff00ff), yellow (#ffff00), green (#00ff00), gold (#ffd700)
- **Font:** Press Start 2P (pixel font, loaded from public/fonts/)
- **Aesthetic:** 8/16-bit pixel art + modern neon cyberpunk/synthwave
- **Effects:** CRT scanlines, bloom glow, particle bursts, screen shake
- **Feel:** Every Perfect hit = massive dopamine — particles, flash, scale pop, glow
