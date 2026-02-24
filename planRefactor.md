# Refactoring Plan — Music Retro Game (Clean Architecture + SOLID)

## Current State Assessment

The codebase already has a solid DDD feature structure (`domain/`, `data/`, `presentation/`, `application/`), dependency injection via ports, and event-driven gameplay. However, several areas violate SOLID principles and clean architecture boundaries.

### Key Issues Identified

| # | Issue | SOLID Violation | Location |
|---|-------|-----------------|----------|
| 1 | `GameScene` has 6+ responsibilities (rendering, effects, audio, events, state reads, ticker) | SRP | `scene/GameScene.ts` |
| 2 | `IGameStatePort.setFinalScore` uses `any` type | ISP/Type Safety | `ports/IGameStatePort.ts` |
| 3 | `NoteTracker` constructor takes `notes: Note[]` but ignores it | ISP/Clean Code | `domain/NoteTracker.ts` |
| 4 | `ComboTracker` lives in `scoring/` but is owned by `GameEngine` in `gameplay/` | Package Cohesion | `scoring/domain/ComboTracker.ts` |
| 5 | `GameScene` directly accesses `useGameStore.getState()` (bypasses ports) | DIP | `scene/GameScene.ts:47,162` |
| 6 | `GameEngine` creates its own dependencies (`new NoteScheduler()`, etc.) | DIP | `application/GameEngine.ts:32-36` |
| 7 | `NoteScheduler` has no port/interface — hard-coupled to Tone.js | OCP/DIP | `data/NoteScheduler.ts` |
| 8 | `BeatAnalysisService` mixes orchestration, fallback logic, and confidence math | SRP | `data/beatAnalysisService.ts` |
| 9 | `GameEngine.handleInput` contains combo-milestone business rule inline | SRP | `application/GameEngine.ts:75` |
| 10 | Double semicolons `;;` in multiple imports | Clean Code | Various files |
| 11 | Magic numbers scattered (0.85, 0.5, 0.2, 50, etc.) | Clean Code | `GameScene.ts`, `constants.ts` |
| 12 | `GameEngine` reads back from state port (`this.state.score`) to compute new score | CQS | `application/GameEngine.ts:83` |

---

## Phase 1: Fix Type Safety & Clean Code Issues

**Goal:** Quick wins that improve correctness without structural changes.

### 1.1 — Fix `IGameStatePort.setFinalScore` type
- **File:** `gameplay/application/ports/IGameStatePort.ts`
- **Change:** Replace `any` with `GameScore` import from `scoring/domain/types`

### 1.2 — Fix `NoteTracker` constructor signature
- **File:** `gameplay/domain/NoteTracker.ts`
- **Change:** Remove unused `notes: Note[]` parameter, keep only `onMiss` callback
- **Update:** All call sites (`GameEngine.ts`)

### 1.3 — Fix double semicolons
- **Files:** `NoteTracker.ts`, `ComboTracker.ts`, `beatAnalysisService.ts`, `GameEventBus.ts`, `GameScene.ts`, `gameStore.ts`
- **Change:** Replace `;;` with `;`

### 1.4 — Extract magic numbers to named constants
- **File:** `gameplay/domain/constants.ts`
- **Add:** `HIT_ZONE_Y_RATIO = 0.85`, `LANE_AREA_WIDTH_RATIO = 0.5`, `TRACKPAD_LANE_AREA_RATIO = 0.2`, `BLOOM_SPIKE_INITIAL = 0.5`, `SHAKE_DURATION = 0.2`, `SHAKE_INTENSITY = 8`, `GLITCH_DURATION = 0.1`, `END_GAME_BUFFER = 2.0`

---

## Phase 2: Dependency Inversion — Inject Instead of Construct

**Goal:** GameEngine depends only on abstractions, not concrete classes.

### 2.1 — Create `INoteSchedulerPort`
- **New file:** `gameplay/application/ports/INoteSchedulerPort.ts`
```ts
export interface INoteSchedulerPort {
    scheduleAll(notes: Note[], onSpawn: (note: Note) => void): void;
    clear(): void;
}
```
- `NoteScheduler` implements this interface
- `GameEngine` receives it via constructor instead of `new NoteScheduler()`

### 2.2 — Create `IHitSoundPort`
- **New file:** `gameplay/application/ports/IHitSoundPort.ts`
```ts
export interface IHitSoundPort {
    playHit(judgment: HitJudgment): void;
    playMilestone(combo: number): void;
    playComboBreak(): void;
    destroy(): void;
}
```
- `HitSoundService` implements this interface

### 2.3 — Create `ITimeProvider` port
- **New file:** `gameplay/application/ports/ITimeProvider.ts`
```ts
export interface ITimeProvider {
    getCurrentTime(): number;
}
```
- Wraps `Tone.getTransport().seconds` — removes direct Tone.js dependency from `GameScene`

### 2.4 — Refactor `GameEngine` constructor
- **File:** `gameplay/application/GameEngine.ts`
- **Change:** Accept all dependencies via constructor (NoteScheduler, NoteTracker as interfaces)
- **Benefit:** Fully testable without Tone.js or browser APIs

---

## Phase 3: Split GameScene (Single Responsibility)

**Goal:** Break the monolithic `GameScene` into focused, single-responsibility classes.

### 3.1 — Extract `EffectsController`
- **New file:** `gameplay/presentation/scene/EffectsController.ts`
- **Owns:** bloom, CRT, glitch, and screen shake logic
- **API:** `triggerBloomSpike()`, `triggerGlitch()`, `triggerShake(intensity, duration)`, `update(dt)`
- **Removes:** All filter/shake state from `GameScene`

### 3.2 — Extract `GameEventListener` (wiring class)
- **New file:** `gameplay/presentation/scene/GameEventListener.ts`
- **Responsibility:** Subscribes to `GameEventBus` and dispatches to the correct handler (effects, sounds, renderers)
- **Removes:** `onHit`, `onMiss`, `onComboBreak`, `onComboMilestone` handlers from `GameScene`
- **Benefit:** GameScene only orchestrates child containers; all event wiring is explicit and replaceable

### 3.3 — Remove direct Zustand access from GameScene
- **File:** `gameplay/presentation/scene/GameScene.ts`
- **Change:** `GameScene.update()` receives state as a parameter instead of calling `useGameStore.getState()`
- **How:** The caller (ticker setup in `GameplayScreen` or `useGameEngine`) passes the relevant state slice each frame
- **Benefit:** GameScene becomes a pure rendering component with no knowledge of state management

### 3.4 — Resulting GameScene
After refactoring, `GameScene` becomes a thin orchestrator:
```ts
class GameScene extends Container {
    constructor(app, config: SceneConfig) { /* create child renderers */ }
    update(frameState: FrameState) { /* delegate to children */ }
    destroy() { /* cleanup */ }
}
```

---

## Phase 4: Move ComboTracker to Gameplay Domain

**Goal:** Align package boundaries with ownership.

### 4.1 — Move `ComboTracker` from `scoring/domain/` to `gameplay/domain/`
- `ComboTracker` is instantiated and managed by `GameEngine` (gameplay feature)
- `ScoringEngine` in `scoring/` is the correct home for final score calculation only
- **Update:** All import paths

### 4.2 — Keep `ScoringEngine` in `scoring/domain/`
- It performs stateless score computation — correct placement
- Ensure it only depends on domain types, no infrastructure

---

## Phase 5: Refactor GameEngine to Own Its Score State

**Goal:** Eliminate bidirectional coupling between GameEngine and state port.

### 5.1 — GameEngine maintains internal score
- **File:** `gameplay/application/GameEngine.ts`
- **Change:** Track `score`, `combo`, `multiplier` internally instead of reading back from `IGameStatePort`
- **Why:** Currently does `this.state.score + addedScore` — reads its own writes through the store, violating CQS
- **After:** GameEngine pushes state updates outward; never reads back

### 5.2 — Simplify `IGameStatePort`
- Remove readable properties (`score`, `hitResults`) — GameEngine should not read from the port
- Keep only write methods: `setCurrentTime`, `setPhase`, `updateScoreAndCombo`, `addHitResult`, `setFinalScore`
- `song` can be passed into GameEngine constructor (already available as `beatMap`)

### 5.3 — Extract combo-milestone logic
- **File:** `gameplay/domain/ComboTracker.ts`
- **Change:** `ComboTracker.hit()` returns a `ComboResult` object:
```ts
interface ComboResult {
    combo: number;
    multiplier: number;
    isMilestone: boolean;
    isBreak: boolean;
}
```
- **Benefit:** Business rule lives in domain, not in `GameEngine.handleInput()`

---

## Phase 6: Refactor BeatAnalysisService

**Goal:** Single responsibility — separate orchestration from computation.

### 6.1 — Extract `AnalysisStrategy` pattern
- **New file:** `analysis/domain/OnsetAnalysisStrategy.ts`
- **Contains:** The logic that decides whether to use onset beats or grid beats (the `>= 16` threshold check)
- **New file:** `analysis/domain/ConfidenceCalculator.ts`
- **Contains:** The confidence scoring formula

### 6.2 — Simplify `BeatAnalysisService`
- Becomes a pure orchestrator: calls DSP → passes to strategy → returns result
- Each step is independently testable

---

## Phase 7: Add Missing Tests

**Goal:** Cover the untested application and presentation logic.

### 7.1 — `GameEngine` unit tests
- Now possible because all dependencies are injected as interfaces
- Test: `start()`, `update()`, `handleInput()`, `endGame()`, `pause/resume`
- Mock all ports

### 7.2 — `EffectsController` unit tests
- Pure state machine — test trigger/update/decay without Pixi

### 7.3 — `ComboTracker.hit()` returns `ComboResult` tests
- Verify milestone detection, break detection

---

## Execution Order & Dependencies

```
Phase 1 (type safety, clean code)     — No dependencies, safe to do first
    ↓
Phase 2 (dependency inversion)        — Depends on Phase 1 (clean signatures)
    ↓
Phase 4 (move ComboTracker)           — Independent, can parallel with Phase 2
    ↓
Phase 5 (GameEngine owns score)       — Depends on Phase 2 (injected deps) + Phase 4 (ComboTracker)
    ↓
Phase 3 (split GameScene)             — Depends on Phase 2 (ITimeProvider, IHitSoundPort)
    ↓
Phase 6 (BeatAnalysisService)         — Independent, can parallel with Phase 3
    ↓
Phase 7 (tests)                       — Depends on all prior phases
```

## Files Changed Summary

| Action | Files |
|--------|-------|
| **Modified** | `GameEngine.ts`, `GameScene.ts`, `NoteTracker.ts`, `ComboTracker.ts`, `IGameStatePort.ts`, `BeatAnalysisService.ts`, `useGameEngine.ts`, `GameplayScreen.ts`, `constants.ts`, `gameStore.ts` + all `;;` files |
| **New** | `INoteSchedulerPort.ts`, `IHitSoundPort.ts`, `ITimeProvider.ts`, `EffectsController.ts`, `GameEventListener.ts`, `OnsetAnalysisStrategy.ts`, `ConfidenceCalculator.ts` + test files |
| **Moved** | `ComboTracker.ts`: `scoring/domain/` → `gameplay/domain/` |
| **Deleted** | None (all changes are refactors of existing code) |

## Principles Applied

- **SRP:** Each class has one reason to change (GameScene split, BeatAnalysis split, ComboResult extraction)
- **OCP:** New effects/sounds/schedulers can be added without modifying GameEngine (port interfaces)
- **LSP:** All port implementations are substitutable (mock-friendly for tests)
- **ISP:** `IGameStatePort` trimmed to write-only; `INoteSchedulerPort` minimal interface
- **DIP:** GameEngine depends on abstractions (ports), not Tone.js/Zustand/concrete classes
- **Clean Architecture:** Dependency arrows point inward — domain has zero external dependencies
