# PixelBeat — Detailed Implementation Plan

## Context

**PixelBeat** is a web-based rhythm game where users upload any audio file, get instant beat analysis via Essentia.js WASM, and play a perfectly synced tapping game with retro-cyberpunk visuals powered by PixiJS v8.

**Tech Stack:** Vite + React 18 + TypeScript (strict) + PixiJS v8 (imperative) + Tone.js + web-audio-beat-detector + Zustand + TailwindCSS v4 + shadcn/ui + framer-motion

**Architecture:** Feature-Sliced Design with clean separation — React owns UI chrome, PixiJS owns the game canvas, Zustand bridges them.

---

## Architecture Overview

### System Diagram
```
┌─────────────────────────────────────────────────────┐
│                    React (UI Layer)                  │
│  Upload Screen │ Analyzing Screen │ Results Screen   │
│  Pause Overlay │ Countdown        │ HUD Overlay      │
└────────────────────────┬────────────────────────────┘
                         │ Zustand Store
┌────────────────────────┴────────────────────────────┐
│                  Game Engine (Core)                   │
│  NoteScheduler │ NoteTracker │ ScoringEngine         │
│  ComboTracker  │ InputManager                        │
└───────┬────────────────┬────────────────┬───────────┘
        │                │                │
┌───────┴──────┐ ┌───────┴──────┐ ┌───────┴──────────┐
│   Tone.js    │ │   PixiJS v8  │ │web-audio-beat-det│
│  Transport   │ │  Application │ │  Web Worker      │
│  Player      │ │  Ticker      │ │  RhythmExtractor │
│  Analyser    │ │  Filters     │ │  BPM + Beats     │
│  Draw        │ │  Particles   │ │                  │
└──────────────┘ └──────────────┘ └──────────────────┘
```

### Audio Sync Chain
```
web-audio-beat-detector (offline) ──→ beat timestamps array
                                      │
Tone.js Transport (real-time)  ◄──────┘ schedules callbacks at beat times
         │
Tone.Draw.schedule()           ──→ bridges audio-thread timing to animation frame
         │
Zustand Store                  ◄──── state updates (activeNotes, score, combo)
         │
PixiJS Ticker (60fps)          ──→ reads store, renders frame
```

### Folder Structure
```
src/
├── app/                           # Root providers, router, global styles
│   ├── providers.tsx
│   └── router.tsx
├── features/                      # Feature-sliced, fully isolated
│   ├── song-upload/
│   │   ├── SongUploadScreen.tsx
│   │   ├── DropZone.tsx
│   │   └── useAudioDecoder.ts
│   ├── beat-analysis/
│   │   ├── AnalyzingScreen.tsx
│   │   ├── useBeatAnalysis.ts
│   │   └── beatMapGenerator.ts
│   ├── gameplay/
│   │   ├── GameplayScreen.tsx
│   │   ├── CountdownOverlay.tsx
│   │   ├── PauseOverlay.tsx
│   │   ├── engine/
│   │   │   ├── GameEngine.ts
│   │   │   ├── NoteScheduler.ts
│   │   │   ├── NoteTracker.ts
│   │   │   └── types.ts
│   │   ├── input/
│   │   │   ├── InputManager.ts
│   │   │   └── useInputManager.ts
│   │   ├── scoring/
│   │   │   ├── ScoringEngine.ts
│   │   │   └── ComboTracker.ts
│   │   ├── scene/
│   │   │   ├── GameScene.ts
│   │   │   ├── LaneRenderer.ts
│   │   │   ├── NoteRenderer.ts
│   │   │   ├── HitZoneRenderer.ts
│   │   │   ├── BackgroundRenderer.ts
│   │   │   ├── HUDRenderer.ts
│   │   │   ├── JudgmentRenderer.ts
│   │   │   ├── LaneFlashRenderer.ts
│   │   │   ├── FrequencyVisualizer.ts
│   │   │   ├── KeybindOverlay.ts
│   │   │   └── SpritePool.ts
│   │   └── effects/
│   │       ├── FilterManager.ts
│   │       ├── ParticleSystem.ts
│   │       ├── ScreenShake.ts
│   │       ├── ComboFlare.ts
│   │       ├── NoteTrailEffect.ts
│   │       └── EffectsConfig.ts
│   ├── results/
│   │   ├── ResultsScreen.tsx
│   │   ├── GradeDisplay.tsx
│   │   ├── StatsBreakdown.tsx
│   │   └── HighScoreTable.tsx
│   └── shared-ui/
│       ├── Layout.tsx
│       ├── NeonText.tsx
│       ├── RetroButton.tsx
│       └── LoadingSpinner.tsx
├── domain/                        # Pure entities, rules, constants
│   ├── types.ts
│   └── constants.ts
├── infrastructure/                # External services, adapters
│   ├── audio/
│   │   ├── audioDecoder.ts
│   │   └── audioPlayback.ts
│   ├── analysis/
│   │   └── beatAnalysisService.ts
│   └── storage/
│       └── highScoreRepository.ts
├── shared/                        # Cross-cutting utilities
│   ├── stores/
│   │   └── gameStore.ts
│   ├── hooks/
│   │   ├── index.ts
│   │   └── useMediaQuery.ts
│   └── utils/
│       ├── index.ts
│       └── performance.ts
├── lib/                           # Third-party wrappers
│   └── pixi/
│       ├── PixiApp.ts
│       └── usePixiApp.ts
├── components/ui/                 # shadcn/ui components
├── main.tsx
├── App.tsx
├── index.css
└── vite-env.d.ts
```

---

## Domain Model

### Core Types (src/domain/types.ts)

```typescript
// ─── Song & Analysis ─────────────────────────────
export interface Song {
  id: string;              // hash of filename + size
  name: string;            // display name
  file: File;              // original file reference
  audioBuffer: AudioBuffer;
  duration: number;        // seconds
}

export interface BeatAnalysis {
  bpm: number;
  beats: number[];         // timestamps in seconds
  confidence: number;      // 0-1
}

export interface BeatMap {
  songId: string;
  bpm: number;
  notes: Note[];
}

// ─── Gameplay ────────────────────────────────────
export type Lane = 0 | 1 | 2 | 3;

export interface Note {
  id: string;
  time: number;            // scheduled hit time in seconds
  lane: Lane;
  type: 'normal' | 'hold';
  duration?: number;       // for hold notes (future)
}

export type HitJudgment = 'perfect' | 'great' | 'good' | 'miss';

export interface HitResult {
  noteId: string;
  judgment: HitJudgment;
  delta: number;           // signed ms offset (negative = early)
  comboAtHit: number;
}

// ─── Scoring ─────────────────────────────────────
export interface GameScore {
  songId: string;
  songName: string;
  totalNotes: number;
  perfects: number;
  greats: number;
  goods: number;
  misses: number;
  maxCombo: number;
  score: number;
  accuracy: number;        // 0-100
  grade: Grade;
  date: number;            // unix timestamp
}

export type Grade = 'S' | 'A' | 'B' | 'C';

// ─── State Machine ───────────────────────────────
export type GamePhase =
  | 'idle'        // upload screen
  | 'analyzing'   // beat analysis running
  | 'ready'       // analysis done, waiting to start
  | 'countdown'   // 3-2-1
  | 'playing'     // active gameplay
  | 'paused'
  | 'results';

export interface GameState {
  phase: GamePhase;
  song: Song | null;
  beatMap: BeatMap | null;
  currentTime: number;
  combo: number;
  multiplier: number;      // 1, 2, 4, or 8
  score: number;
  hitResults: HitResult[];
  finalScore: GameScore | null;
  highScores: GameScore[];
}
```

### Constants (src/domain/constants.ts)

```typescript
export const TIMING_WINDOWS = {
  perfect: 30,   // ±ms
  great: 70,
  good: 120,
} as const;

export const COMBO_THRESHOLDS = [
  { combo: 0,  multiplier: 1 },
  { combo: 10, multiplier: 2 },
  { combo: 30, multiplier: 4 },
  { combo: 50, multiplier: 8 },
] as const;

export const SCORE_VALUES = {
  perfect: 300,
  great: 200,
  good: 100,
  miss: 0,
} as const;

export const GRADE_THRESHOLDS = {
  S: 95,  // accuracy %
  A: 85,
  B: 70,
  C: 0,
} as const;

export const LANE_COUNT = 4;
export const NOTE_FALL_DURATION = 2.0;  // seconds
export const LANE_KEYS = ['d', 'f', 'j', 'k'] as const;
```

---

## Phase 1: Project Scaffolding (~15 files)

**Goal:** Running Vite dev server with full folder structure, all dependencies, TailwindCSS, shadcn/ui, pixel font, domain types, and Zustand store.

### What to build
1. Initialize Vite project with React + TypeScript + SWC
2. Install all dependencies (see package list above)
3. Configure TailwindCSS v4 with `@tailwindcss/vite` plugin
4. Set up shadcn/ui with `components.json`
5. Add Press Start 2P font to `public/fonts/` and `@font-face` in `index.css`
6. Create entire folder structure with placeholder files
7. Implement `domain/types.ts` and `domain/constants.ts` (full implementations above)
8. Implement `shared/stores/gameStore.ts` (Zustand store with all state + actions)
9. Create `app/router.tsx` — simple phase-based router rendering the correct screen
10. Create `App.tsx` — renders router, applies global styles
11. Global CSS: dark cyberpunk theme, pixel font, neon color variables, basic animations

### Package.json dependencies
```json
{
  "dependencies": {
    "react": "^18.3.1",
    "react-dom": "^18.3.1",
    "pixi.js": "^8.6.0",
    "pixi-filters": "^6.1.5",
    "tone": "^15.0.4",
    "web-audio-beat-detector": "^8.2.12",
    "zustand": "^5.0.0",
    "nanoid": "^5.0.0",
    "clsx": "^2.1.0",
    "tailwind-merge": "^2.0.0",
    "class-variance-authority": "^0.7.0",
    "lucide-react": "^0.400.0",
    "framer-motion": "^11.0.0"
  },
  "devDependencies": {
    "typescript": "^5.6.0",
    "vite": "^6.0.0",
    "@vitejs/plugin-react-swc": "^3.7.0",
    "tailwindcss": "^4.0.0",
    "@tailwindcss/vite": "^4.0.0",
    "@types/react": "^18.3.0",
    "@types/react-dom": "^18.3.0"
  }
}
```

### Verification
- `npm run dev` starts, shows "PixelBeat" in Press Start 2P font on dark background
- Tailwind classes work
- TypeScript compiles without errors
- `npx shadcn@latest add button` works

---

## Phase 2: Song Upload + Drag & Drop UI (~6 files)

**Goal:** User can drag-drop or browse for an audio file. File is decoded to AudioBuffer and stored in Zustand. Phase transitions to `analyzing`.

### What to build
1. **DropZone.tsx** — Handles dragenter/dragleave/dragover/drop events. Shows different states: idle (pulsing border), hovering (bright neon glow), accepted (checkmark). Accepts audio/* MIME types.
2. **SongUploadScreen.tsx** — Full-screen layout with centered DropZone, title "DROP YOUR TRACK", subtitle with supported formats, "or click to browse" with hidden file input.
3. **useAudioDecoder.ts** — Hook that takes a File, calls `audioDecoder.ts`, returns { isDecoding, error, audioBuffer }.
4. **audioDecoder.ts** — `async function decodeAudioFile(file: File): Promise<AudioBuffer>` using `AudioContext.decodeAudioData`. Creates and closes AudioContext per call.
5. Install shadcn/ui `button` and `card` components.

### Visual design
- Dark background (#0a0a1a) with subtle grid pattern
- Neon cyan/magenta border that pulses
- Press Start 2P font for all text
- File icon from lucide-react
- Smooth transitions with framer-motion

### Verification
- Drag MP3/WAV onto screen → file name appears, proceed button active
- Click browse → file picker opens with audio filter
- Non-audio files → error message
- Clicking proceed → phase = `analyzing`

---

## Phase 3: Beat Analysis Service (~6 files)

**Goal:** AudioBuffer analyzed via web-audio-beat-detector. Returns BPM. Generates BeatMap with lane-assigned notes.

### What to build
1. **beatAnalysisService.ts** — Main-thread wrapper. Uses `guess()` from web-audio-beat-detector, returns Promise that resolves with BeatAnalysis. Handles errors and timeouts.
2. **beatMapGenerator.ts** — `generateBeatMap(songId, analysis): BeatMap`. Converts beat timestamps to Note objects. Lane assignment algorithm: deterministic pseudo-random based on beat index, avoids 3+ same lane in a row, slight center-lane weight.
3. **useBeatAnalysis.ts** — Hook: triggers analysis on mount, updates store with progress and results.
4. **AnalyzingScreen.tsx** — Animated progress screen: spinning pixel waveform, "Analyzing your track…" / "Detecting beats…" / "Almost there…" messages, progress bar, BPM preview when detected.

### Fallback strategy
If analysis fails or detects poor rhythm, we generate evenly-spaced beats at a guessed BPM as a fallback.

### Verification
- Upload song → analyzing screen shows with animated progress
- After 5-15s → console shows BPM, beat count, confidence
- Phase transitions to `ready`
- Test with MP3, WAV, OGG
- Test with very short (<10s) and long (>5min) tracks

---

## Phase 4: Core Gameplay Engine (~7 files)

**Goal:** Tone.js plays audio synced to Transport. Notes scheduled. Game loop tracks note state. Verified via console before PixiJS visuals.

### What to build

1. **audioPlayback.ts** — `AudioPlaybackService` class:
   - `load(audioBuffer)` — converts to Tone.ToneAudioBuffer, creates Tone.Player
   - `start()` — `await Tone.start()`, `player.sync().start(0)`, `Transport.start()`
   - `pause()` / `resume()` / `stop()` — Transport controls
   - `currentTime` getter — `Transport.seconds`
   - `createAnalyser()` — returns Tone.Analyser for frequency visualization

2. **NoteScheduler.ts** — For each note in BeatMap:
   - Calculate spawn time = `note.time - NOTE_FALL_DURATION`
   - `Transport.schedule(audioTime => { Tone.Draw.schedule(() => onNoteSpawn(note), audioTime) }, spawnTime)`
   - Schedule miss detection at `note.time + TIMING_WINDOWS.good/1000`

3. **NoteTracker.ts** — Maintains:
   - `upcoming: Note[]` — not yet spawned
   - `active: Map<string, ActiveNote>` — currently falling
   - `update(currentTime)` — moves notes between states, detects auto-misses
   - `judgeHit(lane, time): HitResult | null` — finds closest active note in lane within timing window

4. **GameEngine.ts** — Orchestrator:
   - Constructor takes BeatMap, AudioPlaybackService, store reference
   - `start()` — schedules all notes, starts audio
   - `update(currentTime)` — called each frame, updates tracker and store
   - `handleInput(lane, time)` — delegates to tracker + scoring
   - `pause()` / `resume()` / `destroy()`

5. **types.ts** — `ActiveNote` (Note + spawnTime + isHit flag), engine config

6. **useGameEngine.ts** — React hook: creates engine on mount, destroys on unmount, connects to store

7. **GameplayScreen.tsx** — Container component: canvas div + HUD overlay (React), starts engine

### Critical timing detail
```
All timing reads use Tone.getTransport().seconds (audio clock)
Never use performance.now() or Date.now() for gameplay timing
Visual updates happen via Tone.Draw → Zustand → PixiJS ticker reads state
```

### Verification
- Click Start → audio plays
- Console logs note spawns at correct times
- Transport time advances smoothly
- Pause (ESC) and resume work
- Song end → phase = `results`

---

## Phase 5: PixiJS Scene (~9 files)

**Goal:** Full visual rendering — 4 lanes, falling notes synced to music, hit zone, background, HUD.

### What to build

1. **PixiApp.ts** — `createPixiApp(canvas)`: Returns `PIXI.Application` initialized with:
   - `antialias: false` (pixel art)
   - `backgroundColor: 0x0a0a1a`
   - `resolution: devicePixelRatio`
   - Resize handler for responsive scaling

2. **usePixiApp.ts** — React hook: creates canvas, appends to ref, inits PixiApp, destroys on cleanup

3. **GameScene.ts** — Top-level Container. Creates and manages all sub-renderers. Connected to PixiJS Ticker:
   ```
   app.ticker.add(() => {
     const time = Tone.getTransport().seconds;
     gameEngine.update(time);
     noteRenderer.update(time, store.activeNotes);
     hudRenderer.update(store.score, store.combo);
     backgroundRenderer.update(time);
   });
   ```

4. **LaneRenderer.ts** — 4 vertical lane strips with:
   - Semi-transparent dark backgrounds
   - Neon-colored divider lines (cyan, magenta, yellow, green)
   - Subtle scrolling grid pattern for depth

5. **NoteRenderer.ts** — Manages note sprites:
   - Uses SpritePool (pre-allocate ~100 sprites)
   - Each frame: `y = lerp(SPAWN_Y, HIT_ZONE_Y, progress)` where `progress = 1 - timeUntilHit / FALL_DURATION`
   - Notes are 32x32 pixel diamonds, tinted per lane
   - Scale pulse as note approaches hit zone

6. **HitZoneRenderer.ts** — Horizontal glowing bar at 85% screen height:
   - Constant subtle pulse animation
   - Brightens on hit
   - Per-lane hit indicators

7. **BackgroundRenderer.ts** — Perspective grid scrolling downward:
   - Dark grid lines on darker background
   - Speed synced to BPM
   - Creates depth/motion illusion

8. **HUDRenderer.ts** — PixiJS text overlays:
   - Score counter (top-right, pixel font)
   - Combo counter (center, scales up on increment)
   - Multiplier badge (x1/x2/x4/x8 with color)
   - Progress bar (song position)

9. **SpritePool.ts** — Generic pool:
   - `acquire(): Sprite` — returns available or creates new
   - `release(sprite)` — hides and returns to pool
   - Pre-allocates on construction

### Verification
- Notes fall in sync with music
- Correct lane placement
- Hit zone visible and pulsing
- HUD shows score/combo
- 60fps stable (check with browser perf tools)
- Smooth note spawn/despawn
- Browser resize scales correctly

---

## Phase 6: Input + Scoring + Combo (~6 files)

**Goal:** D/F/J/K hit notes with timing judgment. Score accumulates. Combo builds. Visual feedback.

### What to build

1. **InputManager.ts** — Keyboard handler:
   - Maps D=lane0, F=lane1, J=lane2, K=lane3
   - Spacebar = hit any lane (simplified mode)
   - Ignores key repeat (`e.repeat`)
   - Uses `Tone.getTransport().seconds` for precise timing
   - Calls `onInput(lane, time)` callback

2. **useInputManager.ts** — Hook: creates InputManager, binds to window, cleans up

3. **ScoringEngine.ts** — Stateless judge:
   - `judge(note, hitTime): HitJudgment` — compares |delta| to timing windows
   - `calculateScore(judgment, multiplier): number`
   - `calculateAccuracy(results): number` — weighted average
   - `calculateGrade(accuracy): Grade`

4. **ComboTracker.ts** — Stateful:
   - `combo: number`, `maxCombo: number`
   - `get multiplier()` — lookup in COMBO_THRESHOLDS
   - `hit(judgment)` — increment or reset

5. **JudgmentRenderer.ts** — PixiJS text that appears at hit zone:
   - "PERFECT!" (gold, large, sparkle), "GREAT!" (cyan), "GOOD!" (green), "MISS" (red, shake)
   - Floats upward, fades out over 0.5s
   - Scale pop on spawn (1.5 → 1.0)

6. **LaneFlashRenderer.ts** — Lane background briefly brightens on keypress:
   - Colored per lane (matching note tint)
   - Quick flash: 0.1s bright, 0.2s fade

### Input flow
```
keydown → InputManager → GameEngine.handleInput(lane, time)
  → NoteTracker.judgeHit(lane, time) → closest note in window
  → ScoringEngine.judge(note, time) → HitJudgment
  → ComboTracker.hit(judgment) → updated combo/multiplier
  → Store update → JudgmentRenderer + LaneFlashRenderer react
```

### Verification
- D/F/J/K flash correct lane
- Hitting note shows correct judgment text
- Score increments: 300×multiplier for Perfect, etc.
- Combo: 0→1→2... miss→0
- Multiplier badge: x1 at 0, x2 at 10, x4 at 30, x8 at 50
- Missed notes (passed hit zone) auto-judge as Miss

---

## Phase 7: Visual Effects (~6 files)

**Goal:** Full retro-cyberpunk treatment. CRT scanlines, bloom, particle explosions, screen shake, music-reactive background.

### What to build

1. **FilterManager.ts** — Filter pipeline on stage:
   - `CRTFilter` from pixi-filters: scanlines, vignetting (0.3), curvature (1.5), noise
   - `AdvancedBloomFilter`: threshold 0.4, scale 1.2, brightness 1.1
   - `update(time)`: animate CRT time for scanline movement
   - `setEnabled(boolean)`: toggle for performance

2. **ParticleSystem.ts** — Pooled particle effects:
   - Pre-allocate ~200 small pixel sprites
   - On hit: spawn 10-30 particles at note position
   - Each particle: random velocity, alpha fade (1→0 over 0.5s), scale shrink, gravity
   - Perfect = 30 particles (gold), Great = 20 (cyan), Good = 10 (green)
   - `update(dt)`: move all active particles, recycle dead ones

3. **ScreenShake.ts** — Stage offset with decay:
   - `trigger(intensity)`: set shake amount
   - Perfect hit = 3px shake, miss = 6px shake
   - Each frame: random offset × intensity, intensity × 0.9 decay
   - When < 0.5px, snap to 0

4. **ComboFlare.ts** — At x8 multiplier:
   - Persistent glow aura around hit zone
   - Pulsing intensity synced to BPM
   - Rainbow color cycling
   - Fades out when combo breaks

5. **FrequencyVisualizer.ts** — Background bars:
   - `Tone.Analyser('fft', 32)` connected to destination
   - 32 thin vertical bars behind lanes
   - Height mapped from dB values (-100→0 to 0→maxHeight)
   - Smoothed with lerp for fluid animation
   - Subtle neon colors matching lane theme

6. **NoteTrailEffect.ts** — Trailing glow on falling notes:
   - Each note draws a short trail behind it (3-4 fading copies)
   - Brighter as note approaches hit zone
   - Uses alpha gradient

### Verification
- CRT scanlines visible and scrolling
- Bloom glow on notes and hit zone
- Particles burst on every hit (scaled by judgment)
- Screen shake on hits
- Frequency bars dance with music
- Combo flare activates at x8
- FPS stays ≥ 55 with all effects
- Effects can be toggled off

---

## Phase 8: Menus, Results, High Scores (~11 files)

**Goal:** Complete user flow with polished UI screens.

### What to build

1. **Layout.tsx** — Shared wrapper: neon border, dark gradient background, centered content

2. **NeonText.tsx** — Text component with CSS text-shadow glow, pixel font

3. **RetroButton.tsx** — Button with neon border, hover glow, click scale, pixel font

4. **CountdownOverlay.tsx** — React overlay on game canvas:
   - "3" → "2" → "1" → "GO!" with scale animations
   - Each number: large scale-in, hold, fade-out
   - Total duration: 3 seconds
   - Game starts on "GO!"

5. **PauseOverlay.tsx** — ESC to toggle:
   - Semi-transparent dark overlay
   - "PAUSED" title
   - "Resume" and "Quit" buttons
   - Tone.Transport paused during overlay

6. **ResultsScreen.tsx** — Post-game screen container:
   - Animated entrance (framer-motion stagger)
   - Grade, stats, high scores, action buttons

7. **GradeDisplay.tsx** — Large grade letter:
   - Drops in from top with bounce (spring animation)
   - Color: S=gold, A=cyan, B=green, C=red
   - Glow effect matching color
   - Pulsing animation on S rank

8. **StatsBreakdown.tsx** — Hit judgment counts:
   - Horizontal bars: Perfect (gold), Great (cyan), Good (green), Miss (red)
   - Animated fill from 0 to actual count
   - Percentage labels

9. **HighScoreTable.tsx** — Top 10 scores for current song:
   - Rank, score, accuracy, grade, date
   - Current score highlighted if in top 10
   - "NEW!" badge for current run

10. **highScoreRepository.ts** — localStorage CRUD:
    - Key: `pixelbeat_highscores`
    - `getAll(): GameScore[]`
    - `getBySong(songId): GameScore[]` — sorted by score, top 10
    - `save(score)` — append and persist
    - Song ID = simple hash of `filename + fileSize`

11. Update **GameplayScreen.tsx** — Integrate countdown and pause overlays

### Score calculation
```typescript
accuracy = Σ(weight[judgment]) / totalNotes × 100
  weights: perfect=1.0, great=0.75, good=0.5, miss=0

grade:
  accuracy ≥ 95 → S
  accuracy ≥ 85 → A
  accuracy ≥ 70 → B
  accuracy < 70 → C
```

### Verification
- 3-2-1-GO countdown works, game starts after
- ESC pauses, resume continues from exact position
- Results screen shows correct stats
- Grade matches accuracy
- High scores persist across reloads
- "Retry" replays without re-analyzing
- "New Song" returns to upload

---

## Phase 9: Polish & Performance (~5 files)

**Goal:** Edge cases, responsive, mobile, calibration, error handling.

### What to build

1. **KeybindOverlay.ts** — Shows D/F/J/K labels at bottom of each lane (toggleable)

2. **LoadingSpinner.tsx** — Reusable pixel-art spinner component

3. **useMediaQuery.ts** — Hook for responsive breakpoints

4. **performance.ts** — FPS monitor utility, logs warnings when < 50fps

5. **EffectsConfig.ts** — Quality presets:
   - High: all effects on
   - Medium: no CRT, reduced particles (max 100)
   - Low: no filters, minimal particles (max 30)
   - Auto-detect based on first 5 seconds of gameplay FPS

### Polish checklist
- [ ] Responsive canvas: PixiJS resize handler, maintain 4:3 aspect ratio
- [ ] Mobile touch: divide bottom 20% of screen into 4 touch zones
- [ ] Audio latency calibration: settings page with ±ms offset, stored in localStorage
- [ ] Error handling: bad audio files, WASM load failure, AudioContext restrictions
- [ ] Memory: destroy textures, disconnect Tone nodes, clear Workers on cleanup
- [ ] Loading states: skeleton screens during WASM init
- [ ] Audio formats: test MP3, WAV, OGG, FLAC, M4A
- [ ] BPM edge cases: very fast (>200) → reduce note density; very slow (<60) → increase fall speed
- [ ] Fullscreen: toggle button, uses Fullscreen API
- [ ] PWA manifest (if time permits)

### Verification
- Full playthrough: no crashes, no visual glitches
- No memory leaks after 5 consecutive songs
- Chrome + Firefox + Safari (latest)
- Mobile touch works
- Resize browser → canvas scales correctly
- Bad file → graceful error, return to upload

---

## Risk Mitigation

| Risk | Impact | Mitigation |
|------|--------|-----------|
| Essentia.js WASM won't load in Vite worker | Blocks beat detection | Serve WASM from `public/`, use `importScripts`. Fallback: worker JS in `public/` too. Last resort: `web-audio-beat-detector` |
| Audio timing drift between Transport and playback | Notes out of sync | Always use `Transport.seconds` for all timing. Use `Tone.Draw` for visual sync. Never use `performance.now()` |
| pixi-filters v6 incompatible with PixiJS v8 | No CRT/bloom | Fallback: custom shader for CRT, built-in BlurFilter + additive blend for bloom |
| Poor beat detection on complex music | Bad gameplay | Show confidence score. Future: manual BPM override, manual beat tap |
| Particle performance on low-end devices | FPS drops | Object pool (200 max). Auto-reduce particles if FPS < 50. Quality presets |
| Tone.js v15 API changes | Code breaks | Pin exact version. Verify API before implementation |
| Large audio files (>100MB) | Memory issues | Warn user for files > 50MB. Use streaming decode if available |

---

## Implementation Priority

Each phase produces a **runnable milestone**:

| Phase | Milestone | User can... |
|-------|-----------|-------------|
| 1 | App scaffold | See styled title screen |
| 2 | Upload flow | Drop/browse audio file |
| 3 | Beat analysis | See BPM and beat count after analysis |
| 4 | Audio engine | Hear music play with console-logged note events |
| 5 | Visual scene | See notes falling in sync with music |
| 6 | Input + scoring | Play the game! Hit notes, see score |
| 7 | Effects | Experience the full visual spectacle |
| 8 | Complete flow | Full game loop: upload → play → results → retry |
| 9 | Production ready | Polished, responsive, handles edge cases |
