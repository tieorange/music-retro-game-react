# planBugs.md — Potential Bugs in music-retro-game-react

> Deep static analysis across game engine, audio, scoring, beat analysis, and React layer.
> Severity: 🔴 Critical | 🟠 High | 🟡 Medium | 🟢 Low

---

## 🔴 CRITICAL — Crashes / Silent Data Corruption

---

### B-01 · Division by Zero — BPM = 0 in Beat Analysis
**Files affected:**
- `src/features/analysis/data/beatDSP.ts:137`
- `src/features/analysis/data/beatDSP.ts:96`
- `src/features/analysis/data/beatAnalysisService.ts:50`

**Description:**
Three separate callsites divide by `bpm` / `fallbackBpm` with no guard. If the Essentia.js worker returns `bpm = 0` (which it can on silence, very short files, or an initialization failure), the entire analysis pipeline produces `Infinity` / `NaN`, silently corrupting all downstream note timing.

**Code (beatDSP.ts:137):**
```ts
const anchorProximity = 1 - Math.min(1,
    Math.abs(candidateBpm - fallbackBpm) / fallbackBpm   // 💥 fallbackBpm = 0 → Infinity
);
```

**Code (beatDSP.ts:96):**
```ts
const lag = Math.max(1, Math.round((60 / fallbackBpm) * frameRate)); // 💥 → Infinity
```

**Code (beatAnalysisService.ts:50):**
```ts
const beatInterval = 60 / bpm; // 💥 → Infinity → beats = [Infinity, Infinity, ...]
```

**Consequence:** Beat map has notes at time `Infinity`. They are never displayed, never judged. The game appears to have no notes but doesn't crash visibly — a silent gameplay failure.

**Suggested fix:**
```ts
if (!bpm || bpm <= 0) {
    throw new Error(`Invalid BPM from analysis: ${bpm}. Cannot generate beat map.`);
}
```
Or fall back to a safe default BPM (e.g., 120) with a console warning.

---

### B-02 · Log of Zero → NaN Kills Beat Selection
**File:** `src/features/analysis/data/beatDSP.ts:178`

**Description:**
The interval penalty scoring uses `Math.log(lag / targetLag)`. When `lag = 0` (possible if the autocorrelation peak is at index 0), `Math.log(0) = -Infinity`, and squaring it gives `Infinity`, making every candidate score `NaN`.

**Code:**
```ts
const intervalPenalty = -tightness * Math.pow(Math.log(lag / targetLag), 2);
// lag=0 → log(0) = -Infinity → Math.pow(-Infinity, 2) = Infinity → score = NaN
```

**Consequence:** `bestLag` stays at its initial value (first lag with any AC score), producing an arbitrary/incorrect BPM. All note timing is wrong.

**Suggested fix:**
```ts
if (lag <= 0) continue; // Skip degenerate lag values
const intervalPenalty = -tightness * Math.pow(Math.log(lag / targetLag), 2);
```

---

### B-03 · Hold Note Duration Can Be Zero or Negative
**File:** `src/features/analysis/domain/beatMapGenerator.ts:198`

**Description:**
Hold note duration is computed as `interval - 0.1`. The wrapping condition `interval > 0.2` means the minimum possible duration is `0.1 + epsilon`. However, floating-point subtraction can yield a duration of `~0` or even a small negative number if `interval` is exactly `0.2` due to IEEE 754 representation. A hold note with zero/negative duration is never completed — it auto-misses instantly when activated.

**Code:**
```ts
// At line 196: condition is interval > 0.2 && interval <= 0.8
last.duration = interval - 0.1; // Could be 0.0999... if interval rounds down
```

**Suggested fix:**
```ts
last.duration = Math.max(0.05, interval - 0.1);
```

---

## 🟠 HIGH — Significant Gameplay Impact / Memory Leaks

---

### B-04 · PixiApp Window Resize Listener Leaks on Every Game Session
**Files:**
- `src/core/lib/PixiApp.ts:32–33`
- `src/core/lib/usePixiApp.ts:31–38`

**Description:**
`createPixiApp` registers a `resize` handler on `window` but never exposes the reference. The `usePixiApp` cleanup only calls `pixiApp.destroy()` — the window listener is orphaned. Each `GameplayScreen` mount adds a new listener.

**Code (PixiApp.ts):**
```ts
const resize = () => {
    app.renderer.resize(window.innerWidth, window.innerHeight);
};
window.addEventListener('resize', resize); // 💥 Never removed
resize();
return app;
```

**Code (usePixiApp.ts cleanup):**
```ts
return () => {
    isDestroyed = true;
    if (localApp) {
        localApp.destroy(true, { children: true, texture: false }); // resize listener not cleaned
    }
};
```

**Consequence:** After 10 game sessions in one browser tab, 10 resize handlers are active. Each calls `renderer.resize()` on a destroyed app, causing potential exceptions and canvas repaints.

**Suggested fix:**
Return cleanup from `createPixiApp`:
```ts
return { app, cleanup: () => window.removeEventListener('resize', resize) };
```
Call `cleanup()` in `usePixiApp`'s effect cleanup.

---

### B-05 · Countdown Uses `setTimeout` — Desyncs from Tone.Transport Audio Clock
**File:** `src/features/gameplay/presentation/GameplayScreen.tsx:57–81`

**Description:**
The 3-2-1-GO countdown drives `setPhase('playing')` via `setTimeout(..., 2800)`. The game engine starts `Tone.Transport` separately (inside `useGameEngine`). JavaScript timers and the Web Audio clock are not synchronized — the audio scheduler fires callbacks relative to `AudioContext.currentTime`, which may drift ±50–200 ms from `setTimeout`. The practical result: the first few notes can appear to require hitting before or after the visual beat.

**Code:**
```ts
// GameplayScreen.tsx
const timerGo = setTimeout(() => {
    setCountdown(null);
    setPhase('playing'); // triggers useGameEngine → engine.start() → Transport.start()
}, 2800);
```

**Consequence:** On low-end devices where timers are clamped (4 ms minimum in background, up to 1000 ms with throttling), the drift can be severe. Audio and notes become decoupled.

**Suggested fix:**
Start `Tone.Transport` at a precisely scheduled future offset before the countdown begins, so notes are scheduled relative to that fixed anchor:
```ts
// At countdown start:
await Tone.start();
Tone.getTransport().start("+3.0"); // start in 3 real seconds
// Countdown visuals driven by requestAnimationFrame comparing AudioContext.currentTime
```

---

### B-06 · Beat Analysis Worker Has No Timeout — Can Hang Forever
**File:** `src/features/analysis/data/beatAnalysisService.ts:30–43`

**Description:**
The worker promise has no timeout. If Essentia.js fails to initialize (network error, WASM load failure), or if analysis stalls on a long/unusual audio file, the Promise never settles. The loading screen spins indefinitely with no way for the user to cancel or retry.

**Code:**
```ts
const { beatTimes, bpm, success, error } = await new Promise<any>((resolve, reject) => {
    worker.onmessage = (e) => resolve(e.data);
    worker.onerror = (e) => reject(e);
    worker.postMessage({ channelData: channels, sampleRate, length }, transferables);
    // 💥 No timeout — hangs forever if worker stalls
});
worker.terminate();
```

**Suggested fix:**
```ts
const workerPromise = new Promise<any>((resolve, reject) => {
    worker.onmessage = (e) => resolve(e.data);
    worker.onerror = reject;
    worker.postMessage({ channelData: channels, sampleRate, length }, transferables);
});
const timeoutPromise = new Promise<never>((_, reject) =>
    setTimeout(() => reject(new Error('Beat analysis timed out after 30s')), 30_000)
);
const result = await Promise.race([workerPromise, timeoutPromise]).finally(() => worker.terminate());
```

---

### B-07 · `useBeatAnalysis` Updates React State After Component Unmount
**File:** `src/features/analysis/presentation/useBeatAnalysis.ts:19–43`

**Description:**
The `useEffect` starts async analysis but has no cleanup / abort mechanism. If the user navigates away (e.g., back to the file upload screen mid-analysis), `.then()` and `.catch()` still execute and call `setProgressStage`, `setPhase`, etc. on the now-unmounted component. Additionally, `hasStarted.current = true` is never reset in the cleanup, so navigating back and re-uploading a file silently skips re-analysis.

**Code:**
```ts
useEffect(() => {
    if (!song || hasStarted.current) return;
    hasStarted.current = true; // 💥 Never reset

    const analysisService = new BeatAnalysisService();
    analysisService.analyze(song.audioBuffer, (stage, percent) => {
        setProgressStage(stage); // 💥 Fires on unmounted component
        setProgressPercent(percent);
    })
    .then((analysis) => {
        setBeatMap(analysis.beatMap); // 💥 Fires on unmounted component
        setPhase('ready');
    })
    .catch((err) => setError(err.message));
    // 💥 No cleanup / no return function
}, [song, mode, difficulty, setBeatMap, setPhase]);
```

**Suggested fix:**
```ts
useEffect(() => {
    if (!song || hasStarted.current) return;
    hasStarted.current = true;
    let cancelled = false;

    const analysisService = new BeatAnalysisService();
    analysisService.analyze(song.audioBuffer, (stage, percent) => {
        if (!cancelled) { setProgressStage(stage); setProgressPercent(percent); }
    })
    .then((analysis) => {
        if (!cancelled) { setBeatMap(analysis.beatMap); setPhase('ready'); }
    })
    .catch((err) => { if (!cancelled) setError(err.message); });

    return () => {
        cancelled = true;
        hasStarted.current = false; // Allow re-analysis on new upload
        analysisService.abort?.();  // If AbortController is added to service
    };
}, [song, mode, difficulty, setBeatMap, setPhase]);
```

---

### B-08 · `AudioPlayback.destroy()` Resets the Global Tone.Transport
**File:** `src/features/audio/data/audioPlayback.ts:72–85`

**Description:**
`destroy()` calls `Tone.getTransport().cancel()` and sets `Tone.getTransport().position = 0`. The Tone.js Transport is a **global singleton** — canceling it removes ALL scheduled events across the app, not just those for this instance. Setting `position = 0` during a rapid restart (e.g., replay) causes the new game's Transport to appear to start from 0 but with no pre-scheduled events (they were just wiped).

**Code:**
```ts
public destroy(): void {
    this.isDestroyed = true;
    this.stop();
    Tone.getTransport().cancel();    // 💥 Cancels ALL events on global transport
    Tone.getTransport().position = 0; // 💥 Resets global transport position
    this.player?.dispose();
    this.player = null;
}
```

**Consequence:** In rapid replay scenarios or if two AudioPlayback instances exist simultaneously (e.g., during transitions), one instance nukes the other's scheduled note events.

**Suggested fix:**
Instead of `cancel()`, cancel only the specific event IDs tracked by `NoteScheduler`:
```ts
// NoteScheduler.destroy():
this.events.forEach(id => Tone.getTransport().clear(id));
this.events = [];
// AudioPlayback.destroy(): remove the global cancel() call
```

---

### B-09 · Lane Jump Direction Always Goes Left Due to Seed Reuse
**File:** `src/features/analysis/domain/beatMapGenerator.ts:154–163`

**Description:**
The seeded random function produces a value in `[0, 1]`. The same seed value `seed` is used for two independent decisions: (1) whether to jump (`seed < laneJumpChance`, e.g., 0.3), and (2) which direction (`seed > 0.5 ? 1 : -1`). Since a jump only happens when `seed < 0.3`, and `0.3 < 0.5`, the direction is **always** `-1` (left). Every jump in every generated map goes left.

**Code:**
```ts
const seed = seededValue(i, time);

if (previousLane < 0) {
    nextLane = Math.floor(seed * LANE_COUNT) as Lane;
} else if (seed < cfg.laneJumpChance) {    // jump occurs when seed < ~0.3
    const shift = seed > 0.5 ? 1 : -1;    // 💥 seed < 0.3 < 0.5 → always -1
    nextLane = ((previousLane + shift + LANE_COUNT) % LANE_COUNT) as Lane;
} else {
    nextLane = previousLane as Lane;
}
```

**Consequence:** All generated beat maps exhibit a leftward drift pattern. Songs with many jumps will always cascade notes toward lane 0.

**Suggested fix:**
```ts
} else if (seed < cfg.laneJumpChance) {
    const dirSeed = seededValue(i + 1000, time); // independent seed for direction
    const shift = dirSeed > 0.5 ? 1 : -1;
    nextLane = ((previousLane + shift + LANE_COUNT) % LANE_COUNT) as Lane;
}
```

---

### B-10 · Hold Note Tick Counter Initialized to Note Schedule Time, Not Input Time
**File:** `src/features/gameplay/domain/NoteTracker.ts:38–48`

**Description:**
When a hold note is first activated, `lastTickTime` is initialized to `activeNote.time` (the scheduled note time), not to the moment the player actually pressed the key. If the player hits the note early, ticks are counted from before the key was pressed, over-counting ticks and awarding extra score. Also, the falsy check `!activeNote.lastTickTime` fails when `activeNote.time === 0` (the first note in a song), leaving `lastTickTime = 0` unset and potentially causing an infinite tick loop.

**Code:**
```ts
if (activeNote.isHeld) {
    if (!activeNote.lastTickTime) activeNote.lastTickTime = activeNote.time; // 💥 time=0 → falsy
    const endTime = activeNote.time + (activeNote.duration || 0);
    if (currentTime >= endTime) {
        activeNote.isHit = true;
        this.active.delete(id);
    } else {
        while (currentTime - activeNote.lastTickTime >= 0.1) { // 💥 may tick before player pressed
            holdTicks++;
            activeNote.lastTickTime += 0.1;
        }
    }
}
```

**Suggested fix:**
Store the input timestamp when `judgeHold` is called:
```ts
// In judgeHold:
note.lastTickTime = time; // actual moment player pressed

// In update — guard:
if (activeNote.lastTickTime === undefined) continue; // not yet held
```

---

### B-11 · `ScoringEngine` — Extra Hit Results Inflate Accuracy
**File:** `src/features/scoring/domain/ScoringEngine.ts:44–55`

**Description:**
If `hitResults.length > totalNotes` (possible if a double-trigger or race condition fires two hit events for one note), `unaccounted` becomes negative and `misses` is not incremented. The extra hit result contributes to `weightedSum` beyond 100%, potentially yielding accuracy > 100%.

**Code:**
```ts
const unaccounted = totalNotes - hitResults.length; // 💥 Can be negative
if (unaccounted > 0) misses += unaccounted;         // 💥 No handling for negative

const accuracy = totalNotes > 0 ? (weightedSum / totalNotes) * 100 : 0; // Can exceed 100
```

**Suggested fix:**
```ts
const unaccounted = Math.max(0, totalNotes - hitResults.length);
misses += unaccounted;
const accuracy = Math.min(100, totalNotes > 0 ? (weightedSum / totalNotes) * 100 : 0);
// Dev-mode assertion:
if (hitResults.length > totalNotes) {
    console.warn(`Hit results (${hitResults.length}) exceed total notes (${totalNotes})`);
}
```

---

## 🟡 MEDIUM — Degraded Experience / Incorrect Behavior

---

### B-12 · Floating-Point Accumulation Drifts Hold Tick Counter
**File:** `src/features/gameplay/domain/NoteTracker.ts:46–48`

**Description:**
Repeatedly adding `0.1` to a float accumulates IEEE 754 error. On a 5-second hold note with 10 ticks/sec, `lastTickTime` after 50 ticks is `startTime + 5.000000000000007` instead of `startTime + 5.0`. The drift is tiny but the tick comparison (`>= 0.1`) can occasionally skip one tick or double-fire near boundaries.

**Code:**
```ts
while (currentTime - activeNote.lastTickTime >= 0.1) {
    holdTicks++;
    activeNote.lastTickTime += 0.1; // 💥 floating-point accumulation
}
// After 50 iterations: lastTickTime has drifted by ~7e-15 seconds
```

**Suggested fix (integer tick index approach):**
```ts
// Store lastTickIndex (number of ticks completed) instead of lastTickTime
const ticksSoFar = Math.floor((currentTime - holdStartTime) / 0.1);
const newTicks = ticksSoFar - activeNote.lastTickIndex;
holdTicks += Math.max(0, newTicks);
activeNote.lastTickIndex = ticksSoFar;
```

---

### B-13 · `handleAutoMiss` Records Wrong `comboAtHit`
**File:** `src/features/gameplay/application/GameEngine.ts:148–163`

**Description:**
When a note auto-misses (player never pressed), `comboAtHit` is hardcoded to `0` even though the player may have had a 200-combo streak. In `handleInput()`, `comboAtHit` correctly records the post-judgment combo, but the miss case records a meaningless `0`. This inconsistency breaks replay analytics and any UI that uses `comboAtHit` to show "combo lost at X".

**Code:**
```ts
private handleAutoMiss(noteId: string, lane: Lane): void {
    const previousCombo = this.combo.combo;
    this.combo.hit('miss');

    const hitResult: HitResult = {
        noteId,
        judgment: 'miss',
        delta: 0,
        comboAtHit: 0  // 💥 Should be previousCombo
    };
}
```

**Suggested fix:**
```ts
comboAtHit: previousCombo,
```

---

### B-14 · Notes With Negative Spawn Time Appear at Wrong Visual Position
**File:** `src/features/gameplay/data/NoteScheduler.ts:22–27`

**Description:**
Notes whose `spawnTime < 0` (notes that appear immediately when the song starts) are scheduled at Transport position `0`, but no initial visual progress is computed. They are spawned at the top of the lane and begin falling from there, even though they should already be partially fallen to reflect elapsed time.

**Code:**
```ts
if (spawnTime < 0) {
    const eventId = Tone.getTransport().schedule((audioTime) => {
        Tone.Draw.schedule(() => onSpawn(note), audioTime); // 💥 no progress offset
    }, 0);
```

The comment says "with pre-computed progress" but no computation exists.

**Consequence:** The first 1–3 notes of a song always pop in at the top of the screen rather than sliding in from where they should be relative to the beat.

**Suggested fix:**
Pass an initial progress value to `onSpawn`:
```ts
if (spawnTime < 0) {
    const initialProgress = Math.min(1, -spawnTime / NOTE_FALL_DURATION);
    const eventId = Tone.getTransport().schedule((audioTime) => {
        Tone.Draw.schedule(() => onSpawn(note, initialProgress), audioTime);
    }, 0);
}
```
The renderer must be updated to accept and apply `initialProgress`.

---

### B-15 · Spurious "Milestone" Events at Combo 150, 200, 250…
**File:** `src/features/gameplay/domain/ComboTracker.ts:47–49`

**Description:**
The milestone detection has two conditions OR'd together. The second condition triggers milestones every 50 combos (150, 200, 250…), but `COMBO_THRESHOLDS` only defines multiplier increases up to combo 100. So milestone events fire at 150, 200, 250 without any corresponding multiplier increase — the UI shows a celebratory flash for no gameplay reward, which feels random and cheap.

**Code:**
```ts
const isThreshold = COMBO_THRESHOLDS.some(t => t.combo === this._combo)
    || (this._combo >= 50 && this._combo % 50 === 0); // 💥 fires at 150, 200, 250…
```

**Suggested fix (two options):**
1. Remove the second clause — milestones only at defined thresholds.
2. Extend `COMBO_THRESHOLDS` to include 150, 200, etc. with a cap multiplier.

---

### B-16 · Touch Lane at Screen Edge Assigns Lane 4 Before Clamping
**File:** `src/features/gameplay/presentation/useInputManager.ts:99–104`

**Description:**
A touch at `clientX = window.innerWidth` gives `Math.floor(innerWidth / laneWidth) = 4`. The TypeScript cast to `0 | 1 | 2 | 3` is applied before the boundary clamp, so lane `4` exists momentarily in typed code. While the clamp corrects it, the invalid type can cause issues if the code is refactored to use the value before clamping.

**Code:**
```ts
lane = Math.floor(touch.clientX / laneWidth) as 0 | 1 | 2 | 3; // 💥 can be 4
if (lane < 0) lane = 0;
if (lane > 3) lane = 3;
```

**Suggested fix:**
```ts
const rawLane = Math.floor(touch.clientX / laneWidth);
lane = Math.max(0, Math.min(3, rawLane)) as Lane;
```

---

### B-17 · `AudioDecoder` Creates New AudioContext Per File Decode
**File:** `src/features/audio/data/audioDecoder.ts:31–41`

**Description:**
A new `AudioContext` is created for every file decode. Browsers enforce a hard limit (~6 simultaneous contexts) and warn at >2. The `close()` call is fire-and-forget (not awaited), so contexts may not be released before the next decode attempt. Also, `decodeAudioData` has no timeout — a malformed file could hang indefinitely.

**Code:**
```ts
const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
try {
    const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
    resolve(audioBuffer);
} finally {
    if (audioContext.state !== 'closed') {
        audioContext.close().catch(console.error); // 💥 not awaited
    }
}
```

**Suggested fix:**
```ts
// Reuse a module-level AudioContext:
let sharedCtx: AudioContext | null = null;
function getAudioContext(): AudioContext {
    if (!sharedCtx || sharedCtx.state === 'closed') {
        sharedCtx = new AudioContext();
    }
    return sharedCtx;
}
```

---

### B-18 · 2-Second Dead Zone After Song Ends
**File:** `src/features/gameplay/application/GameEngine.ts:88–92`

**Description:**
`END_GAME_BUFFER = 2.0` seconds is added to `song.duration` before triggering `endGame()`. During this window, the song has ended, no notes are falling, but the game is still "playing" — inputs register as misses and the combo system is still active.

**Code:**
```ts
if (song && currentTime >= song.duration + END_GAME_BUFFER) {
    this.endGame(); // 2 full seconds after audio ends
}
```

**Consequence:** Players sit in silence tapping nothing before the results screen appears. On mobile where silence is notable, this feels like a crash.

**Suggested fix:**
Reduce `END_GAME_BUFFER` to `0.5` or end the game early once all notes are resolved:
```ts
const allNotesResolved = this.tracker.hasNoRemainingNotes();
if (song && (allNotesResolved || currentTime >= song.duration + 0.5)) {
    this.endGame();
}
```

---

### B-19 · `Tone.context.state` Check in Countdown Races with Engine Start
**File:** `src/features/gameplay/presentation/GameplayScreen.tsx:63–65`

**Description:**
The countdown `useEffect` checks `Tone.context.state !== 'running'` to decide whether to show an audio-unlock overlay. However, `useGameEngine`'s own `useEffect` may have already started the audio context. The two effects run in the same React commit but in unpredictable order. If the engine starts audio first, the unlock overlay never appears (correct), but if the countdown effect runs first, it shows the overlay unnecessarily.

**Code:**
```ts
if (Tone.context.state !== 'running') {
    setNeedsAudioUnlock(true); // 💥 may race with engine starting audio
}
```

---

## 🟢 LOW — Code Quality / Minor Edge Cases

---

### B-20 · `ComboTracker.updateMultiplier()` Sorts Constant Array Every Call
**File:** `src/features/gameplay/domain/ComboTracker.ts:55–64`

`COMBO_THRESHOLDS` is a module-level constant but is spread and sorted inside `updateMultiplier()` on every combo hit. With 4 thresholds this is negligible, but it signals a misunderstanding of immutability.

**Suggested fix:**
```ts
// Module level:
const SORTED_THRESHOLDS = [...COMBO_THRESHOLDS].sort((a, b) => a.combo - b.combo);
```

---

### B-21 · `beatDSP.ts` — Hardcoded Duplicate Min/Max BPM Constants
**File:** `src/features/analysis/data/beatDSP.ts:100–101`

```ts
const minBpm = Math.max(50, 50); // pointless — always 50
const maxBpm = Math.min(220, 220); // pointless — always 220
```
Dead code. The comment says "Optional params in future" but using no-op Math.max/min is confusing. Either accept params or just use the literals.

---

### B-22 · `ScoringEngine` Accuracy Has No Upper Bound Clamp
**File:** `src/features/scoring/domain/ScoringEngine.ts:50`

Accuracy should always be 0–100, but there's no assertion or clamp. After B-11 is fixed this becomes safe, but a defensive clamp adds future-proofing:
```ts
const accuracy = Math.min(100, totalNotes > 0 ? (weightedSum / totalNotes) * 100 : 0);
```

---

### B-23 · `gameStore.ts` — `AudioBuffer` Cannot Serialize to JSON
**File:** `src/state/gameStore.ts:69`

`AudioBuffer` objects are not JSON-serializable. If Zustand's `persist` middleware is ever added, store hydration will silently fail for the `song` field. The `clearAudioBuffer` action exists suggesting awareness of this, but it's only called in one place.

**Suggested fix if persistence is added:**
```ts
persist(gameStore, {
    partialize: (state) => ({
        ...state,
        song: state.song ? { ...state.song, audioBuffer: null } : null,
    }),
})
```

---

### B-24 · `percentile()` Skewed for Small Arrays
**File:** `src/features/analysis/domain/beatMapGenerator.ts:54–59`

For `percentile = 99` with 5 values, `Math.floor(0.99 * 5) = 4 = length - 1`, the same as `percentile = 100`. So the 75th and 99th percentile return identical values on short songs, degrading difficulty scaling.

**Suggested fix:**
```ts
const pos = (percentile / 100) * (sorted.length - 1);
const lower = Math.floor(pos);
const upper = Math.ceil(pos);
return sorted[lower] + (sorted[upper] - sorted[lower]) * (pos - lower);
```

---

### B-25 · `handleInput` Scans All Notes for Near-Miss Even on Confirmed Hit
**File:** `src/features/gameplay/application/GameEngine.ts:115–130`

`getNearestNoteDelta` iterates all active notes to find the closest match. This is also called for near-miss detection on inputs that already produced a hit judgment, wasting a linear scan. Minor performance overhead, negligible at typical note counts.

---

## Summary Table

| ID | Severity | File | Area | Description |
|----|----------|------|------|-------------|
| B-01 | 🔴 Critical | `beatDSP.ts`, `beatAnalysisService.ts` | Analysis | Division by zero when BPM = 0 |
| B-02 | 🔴 Critical | `beatDSP.ts:178` | Analysis | `Math.log(0) = -Infinity` corrupts beat selection |
| B-03 | 🔴 Critical | `beatMapGenerator.ts:198` | Analysis | Hold duration can be 0 or negative |
| B-04 | 🟠 High | `PixiApp.ts`, `usePixiApp.ts` | Memory | Resize listener leaks on every session |
| B-05 | 🟠 High | `GameplayScreen.tsx:57–81` | Timing | setTimeout countdown desyncs from audio clock |
| B-06 | 🟠 High | `beatAnalysisService.ts:30` | Reliability | Worker promise can hang forever, no timeout |
| B-07 | 🟠 High | `useBeatAnalysis.ts:19` | React | State updated on unmounted component, no cleanup |
| B-08 | 🟠 High | `audioPlayback.ts:75` | Audio | `Transport.cancel()` resets global singleton |
| B-09 | 🟠 High | `beatMapGenerator.ts:159` | Generation | Lane jumps always go left (seed reuse bug) |
| B-10 | 🟠 High | `NoteTracker.ts:39` | Gameplay | Hold ticks count from scheduled time not input time |
| B-11 | 🟠 High | `ScoringEngine.ts:44–55` | Scoring | Extra hit results inflate accuracy past 100% |
| B-12 | 🟡 Medium | `NoteTracker.ts:46–48` | Gameplay | Float accumulation drifts hold tick counter |
| B-13 | 🟡 Medium | `GameEngine.ts:160` | Gameplay | Auto-miss `comboAtHit` is always 0 |
| B-14 | 🟡 Medium | `NoteScheduler.ts:22–27` | Visual | Early notes pop in at wrong screen position |
| B-15 | 🟡 Medium | `ComboTracker.ts:47–49` | UX | Milestone events fire at 150, 200… without reward |
| B-16 | 🟡 Medium | `useInputManager.ts:99–104` | Input | Touch at screen edge briefly has invalid lane type |
| B-17 | 🟡 Medium | `audioDecoder.ts:31–41` | Audio | New AudioContext per decode, close() not awaited |
| B-18 | 🟡 Medium | `GameEngine.ts:88–92` | UX | 2-second silent dead zone after song ends |
| B-19 | 🟡 Medium | `GameplayScreen.tsx:63–65` | Timing | Audio unlock check races with engine audio start |
| B-20 | 🟢 Low | `ComboTracker.ts:55–64` | Performance | Constant array sorted every call |
| B-21 | 🟢 Low | `beatDSP.ts:100–101` | Code quality | Dead-code `Math.max(50,50)` constants |
| B-22 | 🟢 Low | `ScoringEngine.ts:50` | Correctness | Accuracy missing upper bound clamp |
| B-23 | 🟢 Low | `gameStore.ts:69` | Persistence | AudioBuffer not serializable — future persist risk |
| B-24 | 🟢 Low | `beatMapGenerator.ts:54–59` | Analysis | Percentile skewed for small arrays |
| B-25 | 🟢 Low | `GameEngine.ts:115–130` | Performance | Nearest-delta scan runs even on confirmed hit |

---

## Recommended Fix Priority

1. **B-01, B-02** — Guard BPM = 0 and lag = 0 before any division / log call
2. **B-06** — Add 30 s timeout + `Promise.race` around the analysis worker
3. **B-04** — Return and call cleanup from `createPixiApp` to stop resize leak
4. **B-07** — Add `cancelled` flag + `hasStarted.current` reset to `useBeatAnalysis`
5. **B-09** — Use an independent seed for lane jump direction
6. **B-08** — Remove global `Transport.cancel()` from destroy; cancel only owned event IDs
7. **B-05** — Synchronize countdown with `AudioContext.currentTime`, not `setTimeout`
8. **B-10** — Set `lastTickTime` from actual input timestamp; use `=== undefined` guard
9. **B-11** — Clamp `unaccounted` to ≥ 0; clamp accuracy to ≤ 100
10. **B-14** — Compute and pass `initialProgress` for notes with negative spawn time
11. **B-03** — Apply `Math.max(0.05, interval - 0.1)` floor on hold duration
12. **B-13** — Use `previousCombo` as `comboAtHit` in auto-miss path
13. **B-12** — Replace float accumulation with integer tick index
14. **B-18** — Reduce END_GAME_BUFFER or detect all-notes-resolved early
15. **B-15** — Remove periodic milestone clause or extend COMBO_THRESHOLDS
