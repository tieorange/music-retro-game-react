# PixelBeat

A retro-cyberpunk rhythm game that runs entirely in the browser.
Pick a built-in track or upload your own song — the beat gets auto-detected and turned into a live note chart.

**Live demo:** https://tieorange.github.io/music-retro-game-react/

---

## Features

- Built-in song library — tracks ship with the app, no upload needed
- Upload any audio file (MP3, WAV, OGG, FLAC, M4A) and play it instantly
- In-browser beat detection via Essentia.js WASM + DSP pipeline
- 4-lane rhythm gameplay with Perfect / Great / Good / Miss judgments
- Score, combo multiplier, accuracy, and grade (S/A/B/C)
- Pause, resume, retry flow
- High score persistence (localStorage)
- PixiJS-powered game scene with arcade visuals and neon effects

---

## Controls

| Mode | Keys |
|---|---|
| Classic | `D` `F` `J` `K` |
| Trackpad | `Space` (single button) |

On mobile: tap lanes directly.

---

## Difficulty

| Level | Description |
|---|---|
| Easy | Sparse notes, forgiving timing |
| Normal | Balanced density |
| Hard | Dense patterns |
| Expert | Full beat density, tight windows |

---

## Tech Stack

- React 18 + TypeScript
- Vite 6
- PixiJS 8
- Zustand (state + localStorage persistence)
- Tone.js (audio playback + hit sounds)
- Essentia.js (WASM beat detection, runs in a Web Worker)
- Tailwind CSS 4
- Framer Motion

---

## Quick Start

```bash
npm install
npm run dev
```

Open the local Vite URL (usually `http://localhost:5173`).

---

## Scripts

```bash
npm run dev       # start dev server with HMR
npm run build     # type-check + production build
npm run preview   # preview the production build locally
npm run deploy    # build + push to GitHub Pages
npm run lint      # run ESLint
npm run test      # run Vitest
```

---

## Adding Songs

Drop any audio file into `public/music/` and restart the dev server.
The file will appear in the built-in song picker automatically.

Supported formats: `mp3` `ogg` `wav` `flac` `m4a` `aac`

Songs in `public/music/` are bundled into the production build and available after deployment.

---

## Deploying

The app deploys to **GitHub Pages** via the `gh-pages` package.

```bash
npm run deploy
```

This runs `npm run build` first (the `predeploy` hook), then pushes the `dist/` folder to the `gh-pages` branch of the repo.

**One-time setup** (already configured in this repo):

1. `vite.config.ts` — set `base` to match the repo name:
   ```ts
   base: "/music-retro-game-react/"
   ```

2. `package.json` — set `homepage` and scripts:
   ```json
   "homepage": "https://<username>.github.io/<repo-name>/",
   "scripts": {
     "predeploy": "npm run build",
     "deploy": "gh-pages -d dist"
   }
   ```

3. Install the package:
   ```bash
   npm install --save-dev gh-pages
   ```

4. On GitHub: **Settings → Pages → Source → Deploy from branch → `gh-pages`**

---

## Project Structure

```
src/
  app/              router (phase-based screen switching)
  core/
    error/          ErrorBoundary
    logging/        Structured logger (ILogger + ring buffer)
    lib/            PixiJS app factory + hook
    ui/             Shared UI components
  features/
    analysis/       Beat detection service + Essentia.js worker
    audio/          Decode, playback, mixer
    gameplay/       Game engine, note scheduler, input, PixiJS scene
    scoring/        Score calculation + results screen
    song-upload/    Upload screen, drop zone, built-in song picker
  state/            Zustand store + logger bridge

public/
  music/            Built-in audio tracks (add files here)
  wasm/             Essentia WASM runtime
```

---

## Debug Logs

In development, a **Copy Logs** button is pinned to the bottom-right corner of every screen.
Clicking it copies a structured JSON debug package to the clipboard, including:

- Session and flow correlation IDs
- Full event log (up to 2000 entries)
- Error summary, last error, analysis stats, game score

You can also run this in the browser console at any time:

```js
window.__pixelBeatDebug.copy()
```

---

Built for rhythm game experiments, fast feedback, and neon vibes.
