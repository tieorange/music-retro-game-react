# planLogs.md - Logging Improvement Plan

## Goal
Create logging that is:
- Easy to debug from one pasted block.
- Structured enough for AI to reason about root cause quickly.
- Clean in code (single logger API, no random `console.*` usage).

## Debug Outcome We Want
When a bug happens, you should be able to copy one log package and send it to AI with:
- Session context (browser/device/app version).
- Step-by-step user flow (upload -> analyze -> ready -> play -> result).
- Error stack + nearby events + timing.
- Key game/audio metrics (BPM, beat count, score/combo timeline, phase changes).

## Current Gaps (from codebase)
- Logging is ad-hoc (`console.log/warn/error`) across hooks/components.
- No correlation id/session id to connect events.
- No standard event names/payload shape.
- No one-click export for all relevant logs.
- Worker/audio/game-engine internals are not consistently observable.

## Target Design

### 1) Central Logger Module
Add `src/core/logging/logger.ts` with a small API:
- `logDebug(event, data?)`
- `logInfo(event, data?)`
- `logWarn(event, data?)`
- `logError(event, data?, error?)`

Rules:
- In production, default to `info+`.
- In development, `debug+`.
- Never call `console.*` directly outside logger internals.
- Keep logger side-effect free except sinks (console/ring buffer/export).

### 2) Structured Log Schema (JSON)
Every log entry should follow this shape:

```ts
interface LogEntry {
  ts: string;                 // ISO time
  level: 'debug' | 'info' | 'warn' | 'error';
  event: string;              // e.g. 'analysis.worker.started'
  sessionId: string;          // one per app session
  flowId?: string;            // one per song attempt / gameplay run
  phase?: string;             // idle/analyzing/ready/countdown/playing/paused/results
  screen?: string;            // SongUploadScreen, GameplayScreen, etc.
  data?: Record<string, unknown>;
  error?: {
    name?: string;
    message: string;
    stack?: string;
    cause?: string;
  };
}
```

### 3) Correlation IDs
- `sessionId`: created once at app start.
- `flowId`: created when user uploads a song; reused through analysis + gameplay + results.
- Include both in all logs.

### 4) In-Memory Ring Buffer + Export
Add `src/core/logging/logStore.ts`:
- Keep last N logs (ex: 2000 entries) in memory.
- Add helper `getDebugLogPackage()` that returns:
  - metadata (app version, userAgent, screen size, audio context state)
  - recent logs sorted by timestamp
  - optional key state snapshot (sanitized)

Add a UI action/button for dev/support:
- `Copy Debug Logs`
- Copies JSON package to clipboard.

### 5) Error Capture Layer
Add global capture in `src/main.tsx`:
- `window.onerror`
- `window.onunhandledrejection`

Add React `ErrorBoundary` around app root:
- Logs render errors with component stack.
- Shows fallback with `Copy Debug Logs` action.

## Event Taxonomy (names you should use)

### App/Router
- `app.started`
- `app.phase.changed`
- `app.mode.changed`
- `app.difficulty.changed`

### Audio Decode
- `audio.decode.started`
- `audio.decode.succeeded`
- `audio.decode.failed`
- `audio.context.start.attempt`
- `audio.context.start.failed`

### Beat Analysis
- `analysis.started`
- `analysis.progress`
- `analysis.worker.started`
- `analysis.worker.succeeded`
- `analysis.worker.failed`
- `analysis.beatmap.generated`
- `analysis.failed`

### Gameplay Engine
- `game.start`
- `game.pause`
- `game.resume`
- `game.retry`
- `game.end`
- `game.input.hit`
- `game.input.miss`
- `game.combo.break`
- `game.score.updated` (sampled/throttled)

### Performance/Resource
- `perf.frame.drop.detected`
- `perf.analysis.duration`
- `perf.decode.duration`
- `resource.worker.terminated`

## Instrumentation Plan by Existing Files

### Replace direct console usage
- `src/features/analysis/presentation/useBeatAnalysis.ts`
- `src/features/gameplay/presentation/GameplayScreen.tsx`
- `src/features/audio/presentation/useAudioDecoder.ts`
- `src/app/router.tsx`
- `src/features/audio/data/audioDecoder.ts`

### Add deeper logs in services
- `src/features/analysis/data/beatAnalysisService.ts`
  - track worker lifecycle, bpm validity, duration timings.
- `src/features/analysis/data/beatAnalysis.worker.ts`
  - emit worker-side diagnostics (payload sizes, bpm result, exception context).
- `src/features/gameplay/application/GameEngine.ts`
  - start/pause/resume/end, hit/miss counts, combo break events.

### Add store transition logs
- `src/state/gameStore.ts`
  - log only important state transitions, not every tiny mutation.
  - must be sampled to avoid noise.

## Logging Hygiene Rules
- Do not log raw audio buffers or giant arrays.
- Do log aggregate stats (duration, channels, sampleRate, beatCount).
- Redact potential personal data (file names optional; if logged, truncate/hash).
- Use stable keys and short payloads.
- Keep event names consistent and lowercase dot format.

## Volume Control
- Use throttling/sampling for high-frequency events:
  - `game.score.updated` every 250ms max.
  - frame/perf events only when threshold exceeded.
- Default ring buffer size: 2000 (configurable).

## Copy-Paste Debug Package Format

```json
{
  "meta": {
    "app": "pixel-beat",
    "version": "0.0.0",
    "exportedAt": "...",
    "sessionId": "...",
    "flowId": "...",
    "userAgent": "...",
    "screen": { "w": 0, "h": 0 },
    "phase": "playing"
  },
  "summary": {
    "errorCount": 0,
    "warnCount": 0,
    "lastError": null,
    "analysis": { "bpm": 0, "beatCount": 0 },
    "game": { "score": 0, "maxCombo": 0 }
  },
  "logs": [
    { "ts": "...", "level": "info", "event": "analysis.started", "data": {} }
  ]
}
```

## Rollout Phases

### Phase 1 - Foundation (quick win)
- Create logger + schema + ring buffer + ids.
- Replace current `console.*` in main hot-path files.
- Add `Copy Debug Logs` utility callable from console/dev UI.

Done when:
- No direct `console.*` in `src/` app code except logger internals.
- You can export one JSON package from a real run.

### Phase 2 - Deep Observability
- Instrument beat analysis, worker, game engine lifecycle.
- Add duration metrics and important counters.
- Add global error handlers + ErrorBoundary integration.

Done when:
- Any thrown error includes context + preceding events in export.
- Analysis/game flow can be reconstructed from logs alone.

### Phase 3 - Quality + Guardrails
- Add tests for logger schema and redaction.
- Add lint rule: disallow `console.*` outside `src/core/logging`.
- Add docs section in README: how to capture logs for bug reports.

Done when:
- CI blocks unstructured logging regressions.
- Bug reports use a consistent log package template.

## Example AI Prompt You Can Use with Logs
"Analyze this PixelBeat debug log package and identify root cause. Please give: 1) likely bug location (file/function), 2) confidence, 3) minimal fix, 4) test cases to prevent regression."

## Success Criteria
- Time-to-diagnose common bugs reduced (target: < 15 minutes with logs only).
- Repro steps become optional for many issues because logs contain flow history.
- New logs remain readable and low-noise over time.

