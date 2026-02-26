# YouTube Import with Backend: Detailed Implementation Plan

## 1. Goal and scope

Enable a player to paste a YouTube URL, import audio into the game, and play it through the existing PixelBeat flow.

Important constraint: YouTube download must happen on a backend worker, not in browser-only frontend.

This plan assumes you only import tracks you are licensed to use.

## 2. Current app baseline (from this repo)

- Frontend stack: React + Vite + TypeScript.
- Current flow:
  - `src/features/song-upload/presentation/SongUploadScreen.tsx`
  - `src/features/audio/presentation/useAudioDecoder.ts`
  - `src/features/audio/data/audioDecoder.ts`
  - `src/features/analysis/presentation/useBeatAnalysis.ts`
- Song sources today:
  - Uploaded local file
  - Built-in file URL (`public/music/*`)
- Analysis is in-browser (Essentia worker). Keep this for v1 integration.

## 3. Recommended target architecture

## 3.1 Components

1. Frontend (existing app on GitHub Pages)
- Submit YouTube URL + license attestation.
- Poll import status.
- Decode imported audio URL with existing `decodeUrl` path.

2. API service (Node.js/TypeScript)
- Validates request.
- Creates import job.
- Exposes status endpoints.
- Returns final audio asset URL.

3. Worker service (Node.js)
- Pulls queued jobs.
- Uses `yt-dlp` to download audio.
- Uses `ffmpeg` to normalize/transcode.
- Uploads final file to object storage.

4. Queue + DB + Object storage
- Queue: Redis/BullMQ.
- DB: Postgres (job state + metadata).
- Storage: S3-compatible bucket (AWS S3 or Cloudflare R2).

## 3.2 High-level flow

1. Client POSTs `/v1/imports` with `youtubeUrl` and attestation fields.
2. API creates `import_job` in DB, enqueues job, returns `{jobId}`.
3. Worker downloads, transcodes, uploads, updates DB status.
4. Client polls `/v1/imports/:jobId` until `status=completed`.
5. Client gets `audioUrl` and calls existing `decodeUrl(audioUrl, title)`.
6. Existing analyzer/gamplay path continues unchanged.

## 4. Backend implementation plan

## 4.1 Architecture principles (Clean Architecture + SOLID)

Use strict dependency direction:

- `Domain` does not import from any outer layer.
- `Application` depends only on `Domain` + port interfaces.
- `Infrastructure` implements ports and depends inward.
- `Interface adapters` (HTTP/queue handlers) call application use cases.

SOLID rules for this backend:

- `S` (Single Responsibility): one class per job (controller, use case, adapter).
- `O` (Open/Closed): add new source/provider via new adapter, not by editing core use cases.
- `L` (Liskov): adapter implementations must honor port contracts (timeouts/errors/return shape).
- `I` (Interface Segregation): small focused ports (e.g. `ITranscoderPort`, not one mega media interface).
- `D` (Dependency Inversion): use cases depend on interfaces, never on `yt-dlp`, Redis, Postgres, or S3 SDK directly.

## 4.2 Service layout (monorepo-friendly)

Create `backend/` with API and worker entry points, plus layered modules:

```text
backend/
  apps/
    api/
      src/main.ts
    worker/
      src/main.ts
  src/
    domain/
      entities/
      value-objects/
      services/
      events/
    application/
      use-cases/
      ports/
      dto/
    interface-adapters/
      http/
        controllers/
        presenters/
        validators/
      queue/
        consumers/
        producers/
    infrastructure/
      persistence/
        postgres/
      queue/
        bullmq/
      media/
        ytdlp/
        ffmpeg/
      storage/
        s3/
      observability/
        logger/
        metrics/
  package.json
```

Keep shared runtime contracts in `backend/src/application/dto` and `backend/src/domain`.

## 4.3 Domain model (core business objects)

Core entities/value objects:

- `ImportJob` entity:
  - `id`, `youtubeUrl`, `status`, `progress`, `error`, `trackId`, `licenseConfirmed`, `licenseNote`.
- `Track` entity:
  - `id`, `sourceVideoId`, `title`, `durationSec`, `audioFormat`, `storageKey`, `cdnUrl`.
- `ImportStatus` value object:
  - Allowed transitions enforced in domain service/state machine.
- `LicenseAttestation` value object:
  - Validates required fields before job creation.

Domain invariants:

- No `completed` job without `trackId`.
- No transition from terminal states (`completed|failed|canceled`) to active states.
- `licenseConfirmed` must be true for job creation.

## 4.4 Application layer (use cases + ports)

Primary use cases:

- `CreateImportJobUseCase`
- `GetImportJobStatusUseCase`
- `CancelImportJobUseCase`
- `ProcessImportJobUseCase` (worker orchestration)

Required port interfaces:

- `IImportJobRepository`
- `ITrackRepository`
- `IUnitOfWork`
- `IJobQueuePort`
- `IYoutubeDownloaderPort`
- `ITranscoderPort`
- `IObjectStoragePort`
- `ISignedUrlPort`
- `IClockPort`
- `ILoggerPort`
- `IMetricsPort`

Use cases return DTOs, not framework objects.

## 4.5 Interface adapters (HTTP + queue)

HTTP controllers:

- Parse request DTO.
- Delegate to use case.
- Map domain/application errors to HTTP status codes.

Queue consumers/producers:

- Producer: enqueue `ProcessImportJob` command with `jobId`.
- Consumer: load job and execute `ProcessImportJobUseCase`.

Presenters:

- Convert internal status enums/errors to client-safe response payloads.
- Never expose raw infra errors (e.g., ffmpeg stderr) directly to clients.

## 4.6 Infrastructure adapters

Concrete adapters:

- Postgres repositories for `IImportJobRepository`, `ITrackRepository`.
- BullMQ adapter for `IJobQueuePort`.
- `yt-dlp` process adapter for `IYoutubeDownloaderPort`.
- `ffmpeg` process adapter for `ITranscoderPort`.
- S3/R2 adapter for `IObjectStoragePort` + `ISignedUrlPort`.
- Structured logger + metrics adapters.

Implementation constraints:

- All process execution via arg arrays (`spawn(file, args, ...)`), no shell interpolation.
- Timeouts and max-output limits enforced in downloader/transcoder adapters.
- Temp files isolated per job ID and always cleaned in `finally`.

## 4.7 API contract (v1)

### `POST /v1/imports`
Request:

```json
{
  "youtubeUrl": "https://www.youtube.com/watch?v=...",
  "licenseConfirmed": true,
  "licenseNote": "internal catalog id or contract ref"
}
```

Response:

```json
{
  "jobId": "imp_123",
  "status": "queued"
}
```

### `GET /v1/imports/:jobId`
Response example (processing):

```json
{
  "jobId": "imp_123",
  "status": "downloading",
  "progress": 42,
  "message": "Downloading audio stream"
}
```

Response example (completed):

```json
{
  "jobId": "imp_123",
  "status": "completed",
  "track": {
    "trackId": "trk_456",
    "title": "Song Title",
    "durationSec": 187,
    "audioUrl": "https://cdn.example.com/tracks/trk_456.mp3"
  }
}
```

### `POST /v1/imports/:jobId/cancel` (optional)
- Marks job canceled and worker stops if possible.

### `GET /healthz`
- Readiness/liveness for deployment.

## 4.8 DB schema (minimal)

### `import_jobs`
- `id` (pk)
- `youtube_url`
- `status` (`queued|validating|downloading|transcoding|uploading|completed|failed|canceled`)
- `progress` int
- `error_code` nullable
- `error_message` nullable
- `created_at`, `updated_at`
- `requested_by` (optional user id/ip hash)
- `license_confirmed` bool
- `license_note` text nullable
- `track_id` nullable fk

### `tracks`
- `id` (pk)
- `source` (`youtube`)
- `source_video_id`
- `title`
- `duration_sec`
- `storage_key`
- `cdn_url`
- `audio_format` (`mp3` for v1)
- `loudness_lufs` nullable
- `created_at`

## 4.9 Worker pipeline details

`ProcessImportJobUseCase` orchestrates ports in this sequence:

1. Load job and validate state transition (`queued -> validating`).
2. Validate URL format and allowed host.
3. Extract video id via downloader adapter metadata call.
4. Download audio using `yt-dlp` into temp path (`validating -> downloading`).
5. Transcode with `ffmpeg` to stable output (`downloading -> transcoding`):
- codec: mp3
- sample rate: 44100 Hz
- channels: 2
- bitrate: 192k CBR
- optional loudness normalize pass
6. Enforce max duration and max file size.
7. Upload to bucket key like `tracks/{trackId}.mp3` (`transcoding -> uploading`).
8. Persist track row and mark job `completed`.
9. On any failure, map to domain error code and mark job `failed`.
10. Always delete temp files.

## 4.10 Queue and retries

- Queue name: `youtube-imports`.
- Job attempts: 3 with exponential backoff.
- Non-retryable failures: invalid URL, private/geo blocked media, duration limit exceeded.
- Retryable failures: network timeout, transient storage failure.

## 4.11 Security and abuse controls

- API key or authenticated session required for import endpoint.
- Strict rate limits (per IP/user).
- URL allowlist (`youtube.com`, `youtu.be`).
- No raw shell interpolation; pass args as array to child process.
- Store artifacts in private bucket; issue time-limited signed URL or serve via backend proxy.
- Log attestation fields for audit trail.

## 4.12 Deployment recommendation

For your current static frontend deployment, easiest production setup:

- API + Worker on Railway or Render (Docker image with `yt-dlp` + `ffmpeg`).
- Managed Postgres + Redis from same provider.
- S3/R2 for audio storage.
- CDN in front of object storage for playback.

Required env vars (example):

- `API_BASE_URL`
- `DATABASE_URL`
- `REDIS_URL`
- `S3_ENDPOINT`, `S3_BUCKET`, `S3_ACCESS_KEY`, `S3_SECRET_KEY`
- `SIGNED_URL_TTL_SEC`
- `MAX_IMPORT_DURATION_SEC`
- `MAX_IMPORT_FILE_MB`
- `YTDLP_TIMEOUT_SEC`
- `FFMPEG_TIMEOUT_SEC`

## 5. Frontend integration plan (this repo)

## 5.1 New UI and state pieces

Add to upload screen:

- YouTube URL input
- "I confirm I have license rights" checkbox
- Import button
- Job status progress area (queued/downloading/transcoding)

Suggested new files:

- `src/features/song-upload/data/youtubeImportApi.ts`
- `src/features/song-upload/presentation/useYoutubeImport.ts`
- `src/features/song-upload/presentation/YouTubeImportPanel.tsx`

## 5.2 Update song domain type

Current `Song` requires `file: File`. Remote imports are not local files.

Update `src/features/audio/domain/types.ts` to support both local and remote source:

- `sourceType: 'upload' | 'builtin' | 'youtube'`
- `file: File | null`
- `sourceUrl?: string`
- `licenseNote?: string`

This avoids fake `new File([], name)` placeholders.

## 5.3 Upload screen flow changes

In `SongUploadScreen.tsx`:

1. Keep existing local upload and built-in picker.
2. Add YouTube panel.
3. On successful job completion:
- call `decodeUrl(track.audioUrl, track.title)`
- `setSong({ ...sourceType:'youtube', file:null, sourceUrl:track.audioUrl, audioBuffer })`
- `setPhase('analyzing')`

This reuses current beat analysis and game start flow with minimal risk.

## 5.4 Audio decode and playback compatibility

- Existing `decodeUrl` already supports URL fetch + decode.
- Ensure backend/CDN sends CORS headers for your frontend origin.
- If using signed URLs, ensure TTL is long enough to cover decode and gameplay.

## 5.5 Vite runtime config

Add `VITE_IMPORT_API_BASE_URL` and read from `import.meta.env`.

Files to update:

- `src/vite-env.d.ts`
- new API client file under `song-upload/data`

## 6. End-to-end implementation phases

## Phase 1: Backend foundation

Deliverables:
- API service skeleton
- DB migrations
- Queue wiring
- health endpoint

Exit criteria:
- `POST /v1/imports` creates queued job
- `GET /v1/imports/:id` returns status transitions from mocked worker

## Phase 2: Real import pipeline

Deliverables:
- `yt-dlp` download step
- `ffmpeg` transcode step
- object storage upload
- retries and failure categorization

Exit criteria:
- URL import completes and returns playable `audioUrl`
- Temp files cleaned after success/failure

## Phase 3: Frontend integration

Deliverables:
- YouTube import panel
- Polling status UI
- Remote song selection path into existing decoder/store

Exit criteria:
- User pastes URL, sees progress, reaches `analyzing` phase automatically
- Gameplay works with imported track

## Phase 4: Hardening

Deliverables:
- Rate limits
- auth/API key
- observability dashboards and alerts
- better error messages mapped to user-safe text

Exit criteria:
- controlled abuse risk
- actionable monitoring

## 7. Testing strategy

## 7.0 Architecture conformance tests

- Enforce import boundaries with `eslint-plugin-boundaries` or `dependency-cruiser`:
  - `domain` cannot import `application`, `interface-adapters`, or `infrastructure`.
  - `application` cannot import `interface-adapters` or `infrastructure`.
  - `interface-adapters` cannot import concrete infra classes directly (only use-case interfaces).
- Add CI rule that fails on boundary violations.
- Add ADR file for dependency rule and require review approval for any exception.

## 7.1 Backend tests

- Unit:
  - URL parser/validator
  - status transition logic
  - ffmpeg arg builder
- Integration:
  - queue to worker to DB state transitions
  - storage upload adapter
- Contract:
  - API schema tests for `/v1/imports*`

## 7.2 Frontend tests

- Unit:
  - `useYoutubeImport` polling and error handling
- Component:
  - YouTube panel validation (URL + checkbox)
- Integration (Vitest/Playwright):
  - mocked API import success/failure states

## 7.3 Manual QA checklist

- Valid URL imports and plays.
- Invalid/private video shows clear error.
- Job cancellation updates UI.
- Signed URL expiry does not break mid-song.
- Mobile Safari/Chrome memory usage is acceptable.

## 8. Observability

Track these metrics/logs from day 1:

- Import job count by status.
- Time spent in each stage (download/transcode/upload).
- Failure rate by error code.
- Median/95th percentile import latency.
- Frontend decode failure rate for imported URLs.

Correlate logs using `jobId` across API, worker, and frontend.

## 9. Risks and mitigations

1. Long import times for large videos
- Mitigation: hard duration limit and progress UI.

2. Decode failures from uncommon codecs
- Mitigation: force standardized mp3 output from ffmpeg.

3. Abuse/high infra costs
- Mitigation: auth, quotas, rate limits, size limits.

4. CORS/CDN playback failures
- Mitigation: explicit CORS config and preflight tests in staging.

## 10. Suggested implementation order in this repo

1. Add frontend API client + hook (`song-upload/data`, `song-upload/presentation`).
2. Add YouTube panel UI to `SongUploadScreen.tsx`.
3. Expand `Song` type in `src/features/audio/domain/types.ts`.
4. Update `setSong` call sites for new `sourceType/file` shape.
5. Integrate job polling and remote decode path.
6. Validate full flow from idle -> analyzing -> ready -> gameplay.

## 11. v1 vs v2 boundaries

v1 (recommended now):
- Backend only downloads/transcodes/hosts audio.
- Beat analysis remains client-side (current code reused).

v2 (later optimization):
- Move beat analysis to backend worker for repeat imports and caching beatmaps.
- Return precomputed beatmap to reduce client CPU cost.
