# 🎵 PixelBeat

A retro-cyberpunk rhythm game in the browser.
Upload a song, auto-detect its beat, and survive the neon note storm. ⚡

## ✨ What It Does

- 🎧 Upload your own audio track
- 🧠 Analyze tempo/beats in-browser (`web-audio-beat-detector` + Essentia assets)
- 🕹️ Play in **4-lane rhythm mode** with timing judgments
- 🧮 Score, combo, multiplier, and results screen
- 🧱 PixiJS-powered game scene with arcade-style visuals
- 🗃️ Local high score persistence

## 🎮 Controls

- **Classic mode:** `D` / `F` / `J` / `K`
- **Trackpad mode:** `Space` (single-button style)

## 🧪 Difficulty Modes

- 🟢 Easy
- 🔵 Normal
- 🟣 Hard
- 🟡 Expert

## 🛠️ Tech Stack

- React 18 + TypeScript
- Vite 6
- PixiJS 8
- Zustand
- Tone.js
- Tailwind CSS 4
- Vitest

## 🚀 Quick Start

```bash
npm install
npm run dev
```

Open the local Vite URL (usually `http://localhost:5173`).

## 📜 Scripts

```bash
npm run dev      # start dev server
npm run build    # type-check + production build
npm run preview  # preview production build
npm run lint     # run eslint
npm run test     # run vitest
```

## 📁 Project Shape

```text
src/
  app/           # app router + flow
  core/          # shared UI/lib helpers
  features/      # gameplay, analysis, upload, scoring
  state/         # zustand store
public/
  wasm/          # essentia wasm/js runtime files
  workers/       # analysis worker files
```

## 🕹️ Gameplay Flow

1. Upload song
2. Beat analysis
3. Ready screen
4. Countdown
5. Play
6. Results

## ⚠️ Notes

- First run may take a moment while analysis resources warm up.
- Large audio files can increase analysis time.

---

Built for rhythm game experiments, fast feedback, and neon vibes. 🌃
