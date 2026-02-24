# Audio Processing Improvement Plan — Pixel Beat

## Context

The game's audio pipeline works end-to-end (decode → analyze → play → sync → feedback) but has several robustness, quality, and capability gaps that affect the player experience:

- **No volume controls** — music at 0 dB, hit sounds at -8 dB, no user adjustment
- **Beat detection locked to 70-190 BPM and 4/4 time** — fails for slow ballads and fast electronic
- **DSP blocks the main thread** — UI freezes during analysis of longer songs
- **Hit sounds can clip** during combo milestones (up to 6 simultaneous voices with no compressor)
- **Unused FFT analyser** wastes CPU (~345 FFT computations/sec)
- **`essentia.js` bundled (~2 MB) but never imported** — missed opportunity for superior beat detection
- **No seek, no fade, no file validation** — missing baseline playback features

This plan addresses these gaps in priority order. It does **not** overlap with `planRefactor.md` (SOLID/architecture refactoring).

---

## Phase 1: Audio Safety & Robustness

All items in this phase are independent and can be implemented in parallel. They fix issues that affect every play session.

---

### 1.1 — File Validation Before Decode

**Problem:** `audioDecoder.ts` calls `fileReader.readAsArrayBuffer(file)` with zero validation. A user can upload a 500 MB WAV (causing OOM) or a `.pdf` renamed to `.mp3` (causing a confusing "Failed to decode audio data" error).

**User impact:** App freezes or crashes on large files; poor error messages for wrong formats.

**Solution:**

Add validation before reading the file:

```typescript
// New file: src/features/audio/domain/constants.ts
export const MAX_AUDIO_FILE_SIZE = 50 * 1024 * 1024; // 50 MB
export const SUPPORTED_AUDIO_MIME_TYPES = [
    'audio/mpeg', 'audio/wav', 'audio/ogg', 'audio/flac',
    'audio/aac', 'audio/mp4', 'audio/webm'
];
export const SUPPORTED_AUDIO_EXTENSIONS = [
    '.mp3', '.wav', '.ogg', '.flac', '.m4a', '.webm', '.aac'
];
```

```typescript
// New file: src/features/audio/domain/errors.ts
export type AudioErrorCode = 'FILE_EMPTY' | 'FILE_TOO_LARGE' | 'FORMAT_UNSUPPORTED' | 'DECODE_FAILED';

export class AudioValidationError extends Error {
    constructor(public readonly code: AudioErrorCode, message?: string) {
        super(message ?? code);
        this.name = 'AudioValidationError';
    }
}
```

```typescript
// In audioDecoder.ts — add before readAsArrayBuffer:
export function validateAudioFile(file: File): void {
    if (file.size === 0) throw new AudioValidationError('FILE_EMPTY', 'File is empty');
    if (file.size > MAX_AUDIO_FILE_SIZE)
        throw new AudioValidationError('FILE_TOO_LARGE', `File exceeds ${MAX_AUDIO_FILE_SIZE / 1024 / 1024} MB limit`);

    const hasValidType = SUPPORTED_AUDIO_MIME_TYPES.includes(file.type);
    const hasValidExt = SUPPORTED_AUDIO_EXTENSIONS.some(ext =>
        file.name.toLowerCase().endsWith(ext)
    );
    if (!hasValidType && !hasValidExt)
        throw new AudioValidationError('FORMAT_UNSUPPORTED', 'Unsupported audio format');
}

export async function decodeAudioFile(file: File): Promise<AudioBuffer> {
    validateAudioFile(file);  // <-- add this line at the top
    // ... rest of existing code
}
```

**Files:**
- `src/features/audio/data/audioDecoder.ts` — add validation call
- New: `src/features/audio/domain/errors.ts` — typed error classes
- New: `src/features/audio/domain/constants.ts` — size/format constants

---

### 1.2 — Compressor + Limiter on Hit-Sound Bus

**Problem:** In `hitSounds.ts`, all 6 synths connect to a single `Tone.Volume(-8)` → `toDestination()`. When `playMilestone` fires 6 simultaneous voices (combo 100+ at line 107) at the same time as a hit sound, combined amplitude exceeds 0 dBFS, causing digital clipping.

**User impact:** Audible crackling/distortion during high-combo gameplay — exactly when the player should feel rewarded.

**Solution:**

Insert a compressor and limiter between the volume node and destination:

```typescript
// In HitSoundService.init(), replace:
//   this.volumeNode = new Tone.Volume(-8).toDestination();
// with:
this.volumeNode = new Tone.Volume(-8);
this.compressor = new Tone.Compressor({
    threshold: -12,   // start compressing at -12 dBFS
    ratio: 4,         // 4:1 compression ratio
    attack: 0.003,    // fast attack to catch transients
    release: 0.1,     // 100ms release
});
this.limiter = new Tone.Limiter(-1);  // hard ceiling at -1 dBFS
this.volumeNode.connect(this.compressor);
this.compressor.connect(this.limiter);
this.limiter.toDestination();
```

Add `this.compressor.dispose()` and `this.limiter.dispose()` in `destroy()`.

**Files:**
- `src/features/gameplay/data/hitSounds.ts` — add compressor + limiter to signal chain

---

### 1.3 — Remove Unused FFT Analyser

**Problem:** `audioPlayback.ts` line 21-22 creates `Tone.Analyser('fft', 32)` and connects the player to it. This FFT runs every audio processing block (~345 times/sec at 44.1kHz/128 samples), but `getAnalyser()` is never called anywhere in the codebase.

**User impact:** Wasted CPU on every audio callback. On mobile browsers this measurably reduces battery life and can contribute to audio glitches.

**Solution:**

Remove from `AudioPlaybackService`:
- Delete the `analyser` field declaration (line 5)
- Delete analyser creation and player connection (lines 21-22)
- Delete the `getAnalyser()` method (lines 52-54)
- Delete the analyser disposal in `destroy()` (lines 63-66)

If real-time visualization is needed later, create it on demand through a dedicated port interface.

**Files:**
- `src/features/audio/data/audioPlayback.ts` — remove analyser field, creation, connection, getter, disposal

---

### 1.4 — Release AudioBuffer After Load

**Problem:** The game store holds an `AudioBuffer` reference in the `Song` object. After `AudioPlaybackService.load()` copies data into a `ToneAudioBuffer`, the original stays referenced indefinitely. A 5-minute stereo WAV at 44.1kHz = ~50 MB of PCM.

**User impact:** Memory bloat after multiple sequential games; eventual tab crash on constrained devices.

**Solution:**

```typescript
// In game store — add action:
clearAudioBuffer: () => set((state) => ({
    song: state.song ? { ...state.song, audioBuffer: null } : null,
})),

// In useGameEngine.ts — after playback.load() completes:
await playback.load(song.audioBuffer);
useGameStore.getState().clearAudioBuffer();
```

**Files:**
- Game store file — add `clearAudioBuffer` action
- `src/features/gameplay/presentation/useGameEngine.ts` — call after load

---

### 1.5 — Reset Transport Between Games

**Problem:** `Tone.Transport` is a global singleton. Current `destroy()` calls `stop()` and disposes the player, but does not call `cancel()` to clear scheduled events. A second game inherits stale scheduled callbacks.

**User impact:** Ghost notes appearing in the second game; timing offset if position was not zeroed.

**Solution:**

```typescript
// In AudioPlaybackService.destroy(), enhance:
public destroy(): void {
    this.isDestroyed = true;
    const transport = Tone.getTransport();
    transport.stop();
    transport.cancel();       // clear all scheduled events
    transport.position = 0;   // reset position to zero
    if (this.player) {
        this.player.dispose();
        this.player = null;
    }
    // ... rest of cleanup
}
```

**Files:**
- `src/features/audio/data/audioPlayback.ts` — enhanced destroy method

---

## Phase 2: Playback Quality & Sync

These improvements directly affect how "tight" the game feels. A rhythm game lives or dies by audio-visual sync.

---

### 2.1 — Pre-warm AudioContext During Countdown

**Problem:** The countdown runs for ~3 seconds. During this time, no audio operations occur. When `engine.start()` calls `Tone.start()`, it may need to resume a suspended AudioContext — adding 50-200 ms of latency. The first beat feels late.

**User impact:** First beats are unfairly difficult; the game feels laggy at start.

**Solution:**

Add a `warmUp()` method to `IAudioPlaybackPort` and call it when phase transitions to `countdown`:

```typescript
// In IAudioPlaybackPort:
warmUp(): Promise<void>;

// In AudioPlaybackService:
public async warmUp(): Promise<void> {
    if (Tone.context.state !== 'running') {
        await Tone.start();
    }
}

// In useGameEngine.ts or GameplayScreen.tsx, on countdown start:
if (phase === 'countdown') {
    playback.warmUp();
}
```

Then `start()` can skip the `Tone.start()` check since the context is already running.

**Files:**
- `src/features/gameplay/application/ports/IAudioPlaybackPort.ts` — add `warmUp()`
- `src/features/audio/data/audioPlayback.ts` — implement `warmUp()`
- `src/features/gameplay/presentation/useGameEngine.ts` or `GameplayScreen.tsx` — call at countdown

---

### 2.2 — Fix Early-Note Visual Pop-in

**Problem:** `NoteScheduler.ts` clamps negative spawn times to 0 via `Math.max(0, spawnTime)`. Notes with `time < NOTE_FALL_DURATION (2.0s)` spawn at t=0 and appear to "pop in" partway down the screen.

**User impact:** First few notes look broken; players feel they have less reaction time.

**Solution:**

For early notes, schedule them at t=0 but pass the correct (negative) logical spawn time so `NoteRenderer` computes the starting Y position correctly:

```typescript
// In NoteScheduler.scheduleAll:
const spawnTime = note.time - NOTE_FALL_DURATION;

if (spawnTime < 0) {
    // Spawn immediately when Transport starts, with pre-computed progress
    Tone.getTransport().schedule((audioTime) => {
        Tone.Draw.schedule(() => onSpawn(note), audioTime);
    }, 0);
} else {
    // Normal scheduling
    const eventId = Tone.getTransport().schedule((audioTime) => {
        Tone.Draw.schedule(() => onSpawn(note), audioTime);
    }, spawnTime);
    this.eventIds.push(eventId);
}
```

In `NoteRenderer`, ensure position calculation handles the case where the note has already been "falling" for `|spawnTime|` seconds at t=0:

```typescript
const timeUntilHit = note.time - currentTime;
const progress = 1 - (timeUntilHit / NOTE_FALL_DURATION);
// progress > 0 at t=0 for early notes → starts partway down, which is correct
const currentY = spawnY + (hitZoneY - spawnY) * Math.max(0, Math.min(1, progress));
```

**Files:**
- `src/features/gameplay/data/NoteScheduler.ts` — handle negative spawn times
- `NoteRenderer.ts` — ensure correct Y for partial-progress notes at t=0

---

### 2.3 — Add Fade-in/Fade-out on Player

**Problem:** `Tone.Player` starts and stops abruptly. An instantaneous start can create a click artifact if the waveform is not at a zero crossing. Stopping abruptly at song end causes the same.

**User impact:** Audible click/pop at song start and end.

**Solution:**

```typescript
// In AudioPlaybackService.load(), after creating the player:
this.player = new Tone.Player(toneBuffer);
this.player.fadeIn = 0.05;   // 50ms fade-in — imperceptible but eliminates click
this.player.fadeOut = 0.3;    // 300ms fade-out — smooth ending
this.player.toDestination();
this.player.sync().start(0);
```

**Files:**
- `src/features/audio/data/audioPlayback.ts` — set fadeIn/fadeOut on Player

---

## Phase 3: Volume Control System

---

### 3.1 — AudioMixer with 3-Bus Architecture

**Problem:** No volume controls exist. Music is at 0 dB, hits at -8 dB (hardcoded). Users cannot adjust audio to their environment.

**User impact:** Game is either too loud or too quiet; hit sounds may be inaudible under heavy music or annoyingly prominent on quiet tracks.

**Solution:**

Create a centralized mixer with three buses:

```typescript
// New file: src/features/audio/data/AudioMixer.ts
import * as Tone from 'tone';

export class AudioMixer {
    private musicBus: Tone.Volume;
    private sfxBus: Tone.Volume;
    private masterBus: Tone.Volume;
    private masterLimiter: Tone.Limiter;

    constructor() {
        this.masterLimiter = new Tone.Limiter(-0.5).toDestination();
        this.masterBus = new Tone.Volume(0).connect(this.masterLimiter);
        this.musicBus = new Tone.Volume(-6).connect(this.masterBus);
        this.sfxBus = new Tone.Volume(-8).connect(this.masterBus);
    }

    get musicOutput(): Tone.Volume { return this.musicBus; }
    get sfxOutput(): Tone.Volume { return this.sfxBus; }

    setMusicVolume(db: number): void { this.musicBus.volume.value = db; }
    setSfxVolume(db: number): void { this.sfxBus.volume.value = db; }
    setMasterVolume(db: number): void { this.masterBus.volume.value = db; }

    destroy(): void {
        this.musicBus.dispose();
        this.sfxBus.dispose();
        this.masterBus.dispose();
        this.masterLimiter.dispose();
    }
}
```

```typescript
// New file: src/features/audio/application/ports/IAudioMixerPort.ts
export interface IAudioMixerPort {
    readonly musicOutput: Tone.Volume;
    readonly sfxOutput: Tone.Volume;
    setMusicVolume(db: number): void;
    setSfxVolume(db: number): void;
    setMasterVolume(db: number): void;
    destroy(): void;
}
```

Integration changes:
- `AudioPlaybackService.load()` → connect Player to `mixer.musicOutput` instead of `toDestination()`
- `HitSoundService.init()` → connect synths to `mixer.sfxOutput` instead of local volume node; remove the local `Tone.Volume(-8)` node
- Game store → add `musicVolume`, `sfxVolume`, `masterVolume` state for UI binding
- The `Tone.Limiter(-0.5)` at the end guarantees no clipping reaches speakers

**Signal chain after this change:**
```
Player → musicBus (-6 dB) ─┐
                             ├→ masterBus (0 dB) → Limiter (-0.5 dB) → Destination
Synths → sfxBus (-8 dB) ───┘
              ↑
         Compressor (-12 dB threshold, from Phase 1.2)
```

**Files:**
- New: `src/features/audio/data/AudioMixer.ts`
- New: `src/features/audio/application/ports/IAudioMixerPort.ts`
- `src/features/audio/data/audioPlayback.ts` — use mixer.musicOutput
- `src/features/gameplay/data/hitSounds.ts` — use mixer.sfxOutput, remove local volume
- Game store — add volume state

---

## Phase 4: Beat Detection Improvements

These improve the quality of generated beat maps, which directly affects whether notes feel "on beat."

---

### 4.1 — Widen BPM Range + Octave-Error Correction

**Problem:** `estimateTempoFromEnvelope` in `beatDSP.ts` hardcodes `minBpm = 70` and `maxBpm = 190`. Slow ballads (50-70 BPM) and fast electronic/DnB (170-220+ BPM) get incorrect estimates. The autocorrelation also has no octave-error detection — it can lock onto half or double the true tempo.

**User impact:** Notes feel "off" for songs outside the 70-190 range; half-time detection doubles the miss rate.

**Solution:**

1. Widen search range to **50-220 BPM**
2. After finding best lag, test candidates at 2× and 0.5× the best:

```typescript
// After initial bestLag computation:
const candidates = [bestLag, bestLag * 2, Math.round(bestLag / 2)]
    .filter(lag => lag >= minLag && lag <= maxLag);

// Score each by autocorrelation + proximity to perceptual sweet spot (80-160 BPM)
let finalBest = bestLag;
let finalScore = -Infinity;
for (const lag of candidates) {
    let ac = 0;
    for (let i = lag; i < envelope.length; i++) ac += envelope[i] * envelope[i - lag];
    const bpm = 60 / (lag / frameRate);
    const sweetSpotProximity = 1 - Math.min(1, Math.abs(bpm - 120) / 80);
    const anchorProximity = 1 - Math.min(1, Math.abs(bpm - fallbackBpm) / fallbackBpm);
    const score = ac * (0.8 + sweetSpotProximity * 0.1 + anchorProximity * 0.1);
    if (score > finalScore) { finalScore = score; finalBest = lag; }
}
```

3. Make BPM range configurable via parameters with defaults

**Files:**
- `src/features/analysis/data/beatDSP.ts` — modify `estimateTempoFromEnvelope`

---

### 4.2 — Fix HitZoneRenderer Hardcoded 120 BPM

**Problem:** `HitZoneRenderer` line ~53 uses `const beatPhase = time * (120 / 60)`, ignoring the actual song BPM. The visual pulse is out of sync with the music for any non-120 BPM song.

**User impact:** Subtly undermines the player's rhythmic feel — the hit zone doesn't pulse with the beat.

**Solution:**

Pass actual BPM from `beatMap.bpm` through to the renderer:

```typescript
// HitZoneRenderer constructor:
constructor(width: number, y: number, laneCount: number, bpm: number = 120) {
    this.bpm = bpm;
}

// In update():
const beatPhase = time * (this.bpm / 60);
```

Wire it from `GameScene` which has access to the `GameEngine` and its `beatMap.bpm`.

**Files:**
- `HitZoneRenderer.ts` — accept BPM parameter
- `src/features/gameplay/presentation/scene/GameScene.ts` — pass BPM to HitZoneRenderer

---

### 4.3 — Integrate essentia.js for Beat Detection

**Problem:** `essentia.js@0.1.3` is in `package.json` but never imported. Meanwhile, our custom DSP pipeline (`buildOnsetEnvelope` + `estimateTempoFromEnvelope` + `trackBeats` + `refineBeatPhases`) is ~200 lines of hand-written DSP that's limited to 4/4 time and a narrow BPM range.

**User impact:** Opportunity cost — essentia's production-grade `BeatTrackerDegara` algorithm is significantly more accurate and handles odd meters.

**Solution:**

Replace the core beat detection with essentia.js:

```typescript
import { Essentia, EssentiaWASM } from 'essentia.js';

// In BeatAnalysisService.analyze():
const essentia = new Essentia(EssentiaWASM);

// Convert AudioBuffer to mono Float32Array
const left = audioBuffer.getChannelData(0);
const right = audioBuffer.numberOfChannels > 1 ? audioBuffer.getChannelData(1) : left;
const mono = new Float32Array(left.length);
for (let i = 0; i < left.length; i++) {
    mono[i] = (left[i] + right[i]) / 2;
}

// Create essentia vector from mono signal
const signal = essentia.arrayToVector(mono);

// Run beat detection
const beats = essentia.BeatTrackerDegara(signal);
const bpm = essentia.PercivalBpmEstimator(signal).bpm;

// Convert essentia beat positions to seconds array
const beatTimes: number[] = essentia.vectorToArray(beats.ticks);
```

**What to keep from current DSP:**
- `inferDownbeatPhase` — lightweight post-processing for 4/4 alignment
- `buildGridBeats` — fallback when essentia fails or returns too few beats
- `computeBeatAlignmentConfidence` — quality metric

**What to remove or deprecate:**
- `buildOnsetEnvelope` — replaced by essentia's internal onset detection
- `estimateTempoFromEnvelope` — replaced by `PercivalBpmEstimator`
- `trackBeats` — replaced by `BeatTrackerDegara`
- `refineBeatPhases` — essentia's output is already phase-refined

**Files:**
- `src/features/analysis/data/beatAnalysisService.ts` — integrate essentia
- `src/features/analysis/data/beatDSP.ts` — remove replaced functions or keep as fallback

---

### 4.4 — Run Essentia Analysis Off Main Thread

**Problem:** Essentia's WASM algorithms run synchronously. For a 5-minute song, beat detection can take 2-5 seconds, freezing the UI. The progress bar becomes unresponsive.

**User impact:** UI freezes during analysis, especially on mobile.

**Solution:**

Create a Web Worker that loads essentia.js and runs the analysis:

```typescript
// New file: src/features/analysis/data/beatAnalysis.worker.ts
import { Essentia, EssentiaWASM } from 'essentia.js';

let essentia: Essentia | null = null;

self.onmessage = async (e: MessageEvent) => {
    const { channelData, sampleRate, length } = e.data;

    if (!essentia) {
        essentia = new Essentia(await EssentiaWASM());
    }

    // Mix to mono
    const mono = new Float32Array(length);
    const channels = channelData as Float32Array[];
    for (let i = 0; i < length; i++) {
        let sum = 0;
        for (const ch of channels) sum += ch[i];
        mono[i] = sum / channels.length;
    }

    const signal = essentia.arrayToVector(mono);
    const beats = essentia.BeatTrackerDegara(signal);
    const tempo = essentia.PercivalBpmEstimator(signal);

    const beatTimes = essentia.vectorToArray(beats.ticks);
    const bpm = tempo.bpm;

    self.postMessage({ beatTimes, bpm });
};
```

In `BeatAnalysisService`, extract channel data and transfer to worker:

```typescript
// Transfer Float32Arrays (zero-copy):
const channels = [];
const transferables = [];
for (let ch = 0; ch < audioBuffer.numberOfChannels; ch++) {
    const data = audioBuffer.getChannelData(ch).slice(); // copy since getChannelData returns a view
    channels.push(data);
    transferables.push(data.buffer);
}
worker.postMessage(
    { channelData: channels, sampleRate: audioBuffer.sampleRate, length: audioBuffer.length },
    transferables
);
```

**Files:**
- New: `src/features/analysis/data/beatAnalysis.worker.ts`
- `src/features/analysis/data/beatAnalysisService.ts` — use worker for analysis

---

## Phase 5: Advanced Playback Features

---

### 5.1 — Add Seek Capability

**Problem:** `IAudioPlaybackPort` has no `seek()` method. No way to jump to an arbitrary position. Blocks future practice mode, section replay, and scrubbing during results.

**Solution:**

```typescript
// Add to IAudioPlaybackPort:
seek(timeSeconds: number): void;

// Implement in AudioPlaybackService:
public seek(timeSeconds: number): void {
    const transport = Tone.getTransport();
    const wasPlaying = transport.state === 'started';
    transport.pause();
    transport.seconds = timeSeconds;
    if (wasPlaying) {
        transport.start();
    }
}
```

**Files:**
- `src/features/gameplay/application/ports/IAudioPlaybackPort.ts` — add seek
- `src/features/audio/data/audioPlayback.ts` — implement seek

---

### 5.2 — Expose `currentTime`, `duration`, `isPlaying` on the Port

**Problem:** `IAudioPlaybackPort` has no way to query playback state. `GameScene` reaches directly for `Tone.getTransport().seconds`, violating the port abstraction.

**Solution:**

```typescript
// Extended IAudioPlaybackPort:
export interface IAudioPlaybackPort {
    start(): Promise<void>;
    warmUp(): Promise<void>;
    pause(): void;
    resume(): void;
    stop(): void;
    seek(time: number): void;
    destroy(): void;
    load(buffer: AudioBuffer): Promise<void>;

    readonly currentTime: number;
    readonly duration: number;
    readonly isPlaying: boolean;
}

// In AudioPlaybackService:
public get currentTime(): number {
    return Tone.getTransport().seconds;
}

public get duration(): number {
    return this.player?.buffer.duration ?? 0;
}

public get isPlaying(): boolean {
    return Tone.getTransport().state === 'started';
}
```

**Files:**
- `src/features/gameplay/application/ports/IAudioPlaybackPort.ts`
- `src/features/audio/data/audioPlayback.ts`

---

## Execution Order & Dependencies

```
Phase 1 (all 5 items in parallel — no dependencies between them)
    ↓
Phase 2 (depends on Phase 1: 2.1 needs 1.5 clean Transport; 2.3 needs 1.3 clean signal chain)
    ↓
Phase 3 (depends on 1.2 compressor integration and 1.3 clean signal chain)
    ↓
Phase 4 (4.1 and 4.2 are independent; 4.3 essentia decision gates 4.4 worker scope)
    ↓
Phase 5 (depends on 1.5 clean Transport state)
```

## Files Summary

| Action | Files |
|--------|-------|
| **Modified** | `audioDecoder.ts`, `audioPlayback.ts`, `hitSounds.ts`, `useGameEngine.ts`, `beatDSP.ts`, `beatAnalysisService.ts`, `IAudioPlaybackPort.ts`, `GameScene.ts`, `HitZoneRenderer.ts`, `NoteScheduler.ts`, `NoteRenderer.ts`, game store |
| **New** | `audio/domain/errors.ts`, `audio/domain/constants.ts`, `audio/data/AudioMixer.ts`, `audio/application/ports/IAudioMixerPort.ts`, `analysis/data/beatAnalysis.worker.ts` |
| **Deleted** | None (unused analyser code removed from `audioPlayback.ts`, replaced DSP functions optionally kept as fallback) |

## Verification

1. **Phase 1:** Upload a 100 MB file → expect clear "File exceeds 50 MB limit" error. Play a song, reach combo 100 → no audible clipping. Open Chrome DevTools Web Audio tab → no orphan AnalyserNode. Play two games back-to-back → no ghost notes in second game.
2. **Phase 2:** Start a song → no audible click at start. First notes fall smoothly from top (no pop-in). Confirm `AudioContext.state === 'running'` before Transport starts.
3. **Phase 3:** Adjust music/SFX/master sliders → volumes change independently. Maximum combined output never exceeds -0.5 dBFS (verify via Web Audio inspector).
4. **Phase 4:** Test with slow ballad (<70 BPM) and fast DnB (>190 BPM) → correct BPM detected. HitZone pulses at actual song BPM. UI remains responsive during analysis (interact with the page while analyzing).
5. **Phase 5:** Call `seek()` mid-song → playback resumes at new position. Read `currentTime` / `duration` / `isPlaying` from port → correct values.
