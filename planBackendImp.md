# Backend + FE Integration Improvement Plan

## 1. Scope

This document is an audit-driven plan for improving the current `backend/` implementation and its integration with the React frontend.

Primary goals:
- make backend buildable and deployable,
- enforce Clean Architecture + SOLID consistently,
- harden reliability/security of YouTube import pipeline,
- make FE <-> BE contract robust and observable.

## 2. Current state summary (from code review)

The backend has a strong initial direction (entities, use-cases, ports, adapters), but it is still a scaffold and has critical gaps before production use.

Top issues found:

1. Build is currently broken due import path errors.
- `backend/src/application/ports/IDataPorts.ts`
- `backend/src/interface-adapters/http/controllers/ImportController.ts`

2. Worker process is not implemented.
- `backend/apps/worker/src/main.ts`

3. API process currently executes import jobs itself via mock queue.
- `backend/apps/api/src/main.ts`

4. Persistence/storage/queue are in-memory/mock only.
- `backend/apps/api/src/main.ts`

5. Download/transcode pipeline has correctness and safety gaps.
- `backend/src/application/use-cases/ProcessImportJobUseCase.ts`
- `backend/src/infrastructure/media/ytdlp/YtDlpDownloader.ts`
- `backend/src/infrastructure/media/ffmpeg/FfmpegTranscoder.ts`

6. FE integration exists but contract/error handling is incomplete.
- `src/features/song-upload/data/youtubeImportApi.ts`
- `src/features/song-upload/presentation/useYoutubeImport.ts`
- `src/features/song-upload/presentation/YouTubeImportPanel.tsx`

## 3. Prioritized backlog

## P0 - Must fix before any real deployment

### P0.1 Fix backend TypeScript imports and module boundaries

Problem:
- Build fails because of incorrect relative import paths.

Actions:
1. Fix path depth and ESM extension consistency in backend source.
2. Add lint rule to ban unresolved imports in CI.
3. Add a simple `npm run typecheck` script for backend.

Acceptance:
- `npx tsc --project backend/tsconfig.json` passes.

### P0.2 Split composition root from mock implementations

Problem:
- `apps/api/src/main.ts` contains in-memory repositories, queue mocks, mock storage, and server setup in one file.

Actions:
1. Move adapter implementations into `backend/src/infrastructure/*`.
2. Keep `main.ts` as composition root only (wire dependencies, routes, health checks).
3. Keep mock adapters only for local test profile (`NODE_ENV=development`), not default runtime.

Acceptance:
- API startup file becomes thin and adapter wiring is environment-based.

### P0.3 Implement real worker service with BullMQ consumer

Problem:
- Worker is placeholder only; API currently self-processes jobs.

Actions:
1. Implement Redis-backed queue producer in API and consumer in worker.
2. Ensure worker calls `ProcessImportJobUseCase` only.
3. Add graceful shutdown logic (`SIGTERM`, `SIGINT`) for queue worker.

Acceptance:
- API enqueues, worker consumes independently, statuses progress end-to-end.

### P0.4 Fix pipeline correctness bugs

Problem:
- `ProcessImportJobUseCase` uses `raw.audio` path, but `yt-dlp --audio-format wav` produces `.wav`; current path strategy is inconsistent.
- Temp cleanup is disabled.

Actions:
1. Use explicit known raw extension (`raw.wav`) and deterministic output naming.
2. Re-enable cleanup in `finally` with guarded logging.
3. Persist download/transcode/upload progress to repository, not only console.

Acceptance:
- Successful import creates valid MP3 and temp files are cleaned.

## P1 - Architecture hardening (Clean Architecture + SOLID)

### P1.1 Domain invariants and state machine

Problem:
- `ImportJob.updateStatus` blocks terminal transitions but does not enforce valid stage ordering.

Actions:
1. Add explicit transition map:
- `queued -> validating -> downloading -> transcoding -> uploading -> completed`
- any stage -> `failed|canceled`
2. Add typed domain errors (`InvalidStateTransitionError`, `LicenseNotConfirmedError`, etc.).
3. Ensure `complete()` requires a valid persisted `trackId`.

Acceptance:
- Invalid transitions fail deterministically with typed errors.

### P1.2 Use-case purity and ports

Problem:
- Use-cases still use ad-hoc `Date.now()` / `Math.random()` and broad `any` handling.

Actions:
1. Add ports:
- `IIdGeneratorPort`
- `IClockPort`
- `ILoggerPort`
2. Replace `Date.now()`/`Math.random()` with injected ports.
3. Replace `any` response building with typed DTOs in application layer.

Acceptance:
- Use-cases are deterministic/testable and free from infra/random side effects.

### P1.3 Unified error taxonomy

Problem:
- Errors are flattened to `INTERNAL_ERROR` in process use case.

Actions:
1. Add application error codes: `INVALID_URL`, `DOWNLOAD_FAILED`, `TRANSCODE_FAILED`, `DURATION_LIMIT`, `STORAGE_FAILED`, etc.
2. Map infra exceptions to stable application errors.
3. Return safe client-facing error messages via presenter layer.

Acceptance:
- FE receives stable, actionable errors.

### P1.4 Input validation at adapter boundary

Problem:
- Controller does not validate input shape and URL semantics strongly.

Actions:
1. Add Zod schemas for `POST /v1/imports` and route params.
2. Reject non-YouTube hosts and malformed URLs in adapter layer.
3. Normalize canonical URL and extract video ID once.

Acceptance:
- Invalid requests fail early with `400` and structured error body.

## P2 - Reliability, security, and operations

### P2.1 Process execution safety

Actions:
1. Keep `spawn(binary, args)` (already used) and add:
- hard timeouts (`yt-dlp`, `ffmpeg`),
- max stderr capture,
- explicit exit code mapping,
- kill child process on timeout.
2. Track path and file-size validation before upload.

Acceptance:
- No hung jobs from stuck child processes.

### P2.2 Storage and access model

Actions:
1. Store objects privately.
2. Return signed URLs with bounded TTL.
3. Add signed URL refresh endpoint if gameplay can outlive TTL.

Acceptance:
- Audio URLs are not publicly enumerable.

### P2.3 Auth/rate limiting/abuse control

Actions:
1. Require auth token or API key at import endpoint.
2. Add per-user and per-IP limits.
3. Add duration/file-size quotas and max concurrent imports per actor.

Acceptance:
- Abuse and cost exposure are bounded.

### P2.4 Observability

Actions:
1. Structured logs with `jobId`, `trackId`, `requestId`.
2. Metrics:
- import success/failure rates,
- stage latency histograms,
- active jobs,
- queue depth.
3. Health endpoints:
- `liveness` (process alive),
- `readiness` (Redis/DB/storage dependencies).

Acceptance:
- Operators can diagnose incidents quickly.

## 4. Frontend integration improvements

## FE-1 Contract synchronization (high priority)

Problem:
- FE assumes response shapes dynamically and uses `any`.

Actions:
1. Define shared API DTO package (or generate from OpenAPI).
2. Type `createJob` and `getJobStatus` responses.
3. Include `errorCode` + `errorMessage` in status payload for failed jobs.

Acceptance:
- Frontend compiles against contract and catches shape drift at build time.

## FE-2 Polling robustness

Problem:
- Recursive polling has no cancellation/timeout and only handles `completed`/`failed`.

Actions:
1. Add abortable polling with `AbortController`.
2. Add hard max poll duration and retry/backoff policy.
3. Handle statuses: `canceled`, `expired`, `queued/validating/downloading/transcoding/uploading` explicitly.
4. Stop polling on route unmount.

Acceptance:
- No orphan polling loops; predictable UX on network interruptions.

## FE-3 URL/config correctness

Problem:
- Defaulting to `http://localhost:3000` can break production silently.

Actions:
1. Require `VITE_IMPORT_API_BASE_URL` in production builds.
2. Add env validation on app boot with explicit user-facing warning.
3. Document setup in README.

Acceptance:
- Production build fails fast on missing backend URL configuration.

## FE-4 Better UX during import/decode

Actions:
1. Show stage-specific text from backend (`validating`, `downloading`, etc.).
2. Add cancel button wired to `POST /v1/imports/:jobId/cancel`.
3. Preserve imported `trackId` in song state for replay/cache.
4. Show decode failures separately from import failures.

Acceptance:
- Users can understand where failures happen and recover.

## FE-5 CORS and media playback reliability

Actions:
1. Backend must return CORS headers for frontend origin.
2. Validate decode path against signed URLs and CDN headers.
3. Add fallback when URL expires before decode (refresh URL and retry once).

Acceptance:
- Imported tracks decode and play consistently in deployed FE.

## 5. Target implementation slices

## Slice A: Make backend build + run locally (P0)

Tasks:
1. Fix imports.
2. Implement local adapters (file storage + BullMQ + Redis).
3. Implement worker consumption loop.
4. Fix raw file naming + cleanup.

Exit criteria:
- Local import completes from API request to playable asset URL.

## Slice B: Stabilize API contract + FE polling (P0/P1)

Tasks:
1. Typed DTOs in backend + frontend.
2. Zod validation and structured errors.
3. Polling cancellation, timeout, and status map in FE.

Exit criteria:
- FE handles success/failure/cancel paths without hanging.

## Slice C: Security/ops hardening (P2)

Tasks:
1. Auth + rate limits.
2. Signed URLs + TTL strategy.
3. Metrics/logging/readiness checks.

Exit criteria:
- Service ready for external users and incident response.

## 6. Test plan

### Backend

1. Unit tests:
- transition state machine,
- URL validator,
- error mapping,
- progress mapping.

2. Integration tests:
- API + Redis + worker + storage flow,
- retry behavior,
- cancel behavior.

3. Contract tests:
- snapshot/JSON-schema tests for `/v1/imports` and `/v1/imports/:jobId`.

### Frontend

1. Hook tests for `useYoutubeImport`:
- happy path,
- failed path,
- cancel,
- timeout.

2. Component tests for `YouTubeImportPanel`:
- validation UI,
- state transitions,
- error rendering.

3. E2E (mock backend):
- import -> decode -> analyzing phase transition.

## 7. Definition of done

Backend/FE integration is considered ready when:

1. Backend typecheck and tests pass in CI.
2. Worker consumes queued jobs independently of API process.
3. Import pipeline is deterministic and cleans temp resources.
4. FE uses typed contract and resilient polling.
5. End-to-end import works in deployed environment with correct CORS and URL config.
6. Operational metrics and structured logs are available per job.

## 8. Suggested immediate next steps (ordered)

1. Fix import path/typecheck blockers and implement real worker loop.
2. Standardize job status/error DTO and wire FE to it.
3. Add URL validation + retry/timeout/cancel behavior.
4. Add auth/rate limit/signed URL before wider rollout.
