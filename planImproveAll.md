# PixelBeat — Comprehensive Improvement Plan

## Context

PixelBeat is a synthwave rhythm game built with React, TypeScript, Pixi.js, and Tone.js. Players upload audio files, the app analyzes beats, and generates falling-note gameplay (4 lanes: D/F/J/K or single-lane spacebar mode). The game has a strong retro aesthetic but is **desktop-only** (keyboard input), lacks mobile support entirely, and needs more gameplay depth and visual polish to be truly fun and engaging.

**Goals:** Make the game more fun, improve UI/UX, upgrade graphics, and make it fully playable on iPhone Safari and Chrome mobile.

---

## Phase 1: Mobile & Browser Compatibility (CRITICAL PRIORITY)

*The game is currently **100% unplayable on mobile** — no touch input exists at all.*

---

### 1.1 Touch Input System

**Files to modify:**
- `src/features/gameplay/presentation/useInputManager.ts` (main changes)
- `src/features/gameplay/presentation/scene/LaneRenderer.ts` (touch zone visuals)

**Implementation:**

#### Classic Mode (4 lanes):
- Divide the canvas into 4 equal vertical touch zones
- Map each zone to lanes 0-3 (left to right)
- Support simultaneous multitouch (`TouchEvent.changedTouches`) for up to 4 fingers
- On `touchstart`: determine which lane(s) by touch X position relative to lane boundaries
- Call `engine.handleInput(lane, currentTime)` exactly as keyboard does
- Dispatch `lane-hit` CustomEvent for Pixi lane flash animations

#### Trackpad Mode (1 lane):
- Full canvas area = single touch zone → lane 0
- Any tap anywhere triggers lane 0 hit

#### Browser Gesture Prevention:
```css
/* On canvas/game container */
touch-action: none;          /* Prevent scroll, zoom, pan */
-webkit-touch-callout: none; /* Prevent iOS callout */
-webkit-user-select: none;   /* Prevent text selection */
```
- Call `event.preventDefault()` on `touchstart`, `touchmove`, `touchend`
- Prevent double-tap zoom with `touch-action: manipulation` as fallback

#### Visual Touch Feedback:
- Show brief circular ripple at touch point (Pixi Graphics, fade over 200ms)
- Flash lane highlight on touch (reuse existing `lane-hit` event → LaneRenderer flash)

---

### 1.2 Viewport & Safe Area Handling

**Files to modify:**
- `index.html`
- `src/index.css`

**index.html viewport update:**
```html
<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover" />
<meta name="apple-mobile-web-app-capable" content="yes" />
<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
<meta name="theme-color" content="#0a0a1a" />
```

**Safe area CSS (index.css):**
```css
body {
  padding-top: env(safe-area-inset-top);
  padding-bottom: env(safe-area-inset-bottom);
  padding-left: env(safe-area-inset-left);
  padding-right: env(safe-area-inset-right);
}
```

---

### 1.3 Orientation Handling

**Files to modify:**
- `src/features/gameplay/presentation/GameplayScreen.tsx`
- `src/core/lib/PixiApp.ts`

**Landscape Prompt:**
- During `playing` phase, detect portrait orientation via `window.matchMedia('(orientation: portrait)')`
- Show fullscreen overlay: "Rotate your device" with animated phone rotation icon
- Hide overlay when landscape detected

**Resize Handling:**
- Add `orientationchange` event listener alongside existing `resize` listener in PixiApp.ts
- Some mobile browsers fire `orientationchange` but not `resize`, or fire them in different order

---

### 1.4 Safari Audio Compatibility

**Files to modify:**
- `src/features/gameplay/presentation/useGameEngine.ts`
- `src/features/audio/data/audioPlayback.ts`
- `src/features/song-upload/presentation/SongUploadScreen.tsx`

**Pre-warm AudioContext:**
- On the "PLAY NOW" button tap (ready phase), call `await Tone.start()` before transitioning to countdown
- This ensures user gesture triggers AudioContext resume (Safari requirement)
- Show brief "Initializing audio..." if context takes >200ms to start

**Remove unused FFT analyser:**
- In `audioPlayback.ts`: delete `analyser` creation (lines ~21-22) and all references
- Saves CPU on mobile where every cycle counts

**AudioContext state monitoring:**
- Add check: if `Tone.context.state === 'suspended'` after start attempt, show user-facing message
- "Audio blocked. Tap anywhere to enable sound." overlay with tap handler calling `Tone.start()`

---

### 1.5 Fullscreen API

**Files to modify:**
- `src/features/gameplay/presentation/GameplayScreen.tsx`

**Implementation:**
- On game start (countdown phase), request fullscreen:
  ```ts
  document.documentElement.requestFullscreen?.() ||
  document.documentElement.webkitRequestFullscreen?.()
  ```
- On pause/results, exit fullscreen
- Handle fullscreen denial gracefully (some browsers block without gesture)
- Add small fullscreen toggle button in corner of gameplay screen

---

### 1.6 PWA Support

**New files:**
- `public/manifest.json`
- `public/icons/icon-192.png`, `public/icons/icon-512.png`

**manifest.json:**
```json
{
  "name": "PixelBeat",
  "short_name": "PixelBeat",
  "description": "Synthwave Rhythm Action Game",
  "start_url": "/",
  "display": "fullscreen",
  "orientation": "landscape",
  "background_color": "#0a0a1a",
  "theme_color": "#0a0a1a",
  "icons": [
    { "src": "/icons/icon-192.png", "sizes": "192x192", "type": "image/png" },
    { "src": "/icons/icon-512.png", "sizes": "512x512", "type": "image/png" }
  ]
}
```

**index.html additions:**
```html
<link rel="manifest" href="/manifest.json" />
<link rel="apple-touch-icon" href="/icons/icon-192.png" />
```

**Vite PWA plugin:**
- Install `vite-plugin-pwa`
- Configure in `vite.config.ts` for basic service worker (cache app shell, not audio files)

---

## Phase 2: Fun & Gameplay Improvements

*Making the core gameplay loop more satisfying, varied, and replayable.*

---

### 2.1 Long Notes (Hold Notes)

**Files to modify:**
- `src/features/analysis/domain/beatMapGenerator.ts` (generation)
- `src/features/gameplay/domain/NoteTracker.ts` (judgment)
- `src/features/gameplay/presentation/scene/NoteRenderer.ts` (rendering)
- `src/features/gameplay/presentation/useInputManager.ts` (keydown + keyup / touchstart + touchend)
- `src/features/gameplay/domain/constants.ts` (new note type)

**Note Generation:**
- Identify sustained strong beats (consecutive beats in same lane with gap < 0.5s)
- Convert to single hold note with `startTime` and `endTime`
- Only on Normal+ difficulty (Easy stays simple)
- Hold notes worth 300 × duration_beats × multiplier (rewards sustained hold)

**Input Handling:**
- Track `keydown` AND `keyup` events per lane (currently only `keydown`)
- For touch: `touchstart` begins hold, `touchend` releases
- Judge: initial tap accuracy (same as regular note) + hold completion percentage
- Early release: partial score based on % held

**Visual:**
- Render as elongated colored bar/ribbon stretching from note head to tail
- Bar shrinks from top as player holds
- Glow intensifies during successful hold
- Release spark effect on completion

---

### 2.2 Fever Mode (High Combo Reward)

**Files to modify:**
- `src/features/gameplay/domain/ComboTracker.ts`
- `src/features/gameplay/domain/constants.ts`
- `src/features/gameplay/presentation/scene/EffectsController.ts`
- `src/features/gameplay/presentation/scene/BackgroundRenderer.ts`
- `src/features/gameplay/presentation/scene/LaneRenderer.ts`

**Mechanics:**
- At 100+ combo: activate "FEVER MODE"
- 16x score multiplier
- Lasts until combo breaks

**Visuals during Fever:**
- Background grid color cycles through rainbow
- Bloom intensity increased to 2.0
- Lane colors shift to white/gold
- Speed lines on screen edges
- "FEVER!" text pulsing at top center
- Background scroll speed doubled

---

### 2.3 Enhanced Miss Feedback

**Files to modify:**
- `src/features/gameplay/presentation/scene/EffectsController.ts`
- `src/features/gameplay/presentation/scene/HitFeedbackRenderer.ts`
- `src/features/gameplay/presentation/scene/GameEventListener.ts`

**Single Miss:**
- Brief screen desaturation (150ms) — grayscale filter flash
- Existing: glitch + shake (keep but refine)

**Combo Break (was >20 combo):**
- Dramatic: brief slow-motion (Pixi ticker speed × 0.3 for 300ms)
- Shattered combo number: current combo text breaks into fragments that fall with gravity
- Screen flash red at edges (vignette pulse)
- Sound: existing combo break sound + glass shatter SFX

---

### 2.4 Pause & Retry System

**Files to modify:**
- `src/features/gameplay/presentation/GameplayScreen.tsx`
- `src/features/gameplay/application/GameEngine.ts`
- `src/features/gameplay/presentation/useInputManager.ts`
- `src/state/gameStore.ts`

**Pause:**
- Escape key (desktop) or pause button (top-right corner) triggers pause
- `GameEngine.pause()`: stop Tone.Transport, set phase to 'paused'
- Overlay: semi-transparent dark backdrop with options:
  - **RESUME** → 3-2-1 countdown then resume
  - **RETRY** → reset and restart same song
  - **QUIT** → return to upload screen

**Retry:**
- `GameEngine.retry()`: reset NoteTracker, ComboTracker, ScoringEngine, score, combo
- Clear and re-schedule all notes via NoteScheduler
- Restart Tone.Transport from 0
- Skip re-analysis (reuse existing BeatMap)
- Brief countdown (3-2-1) before retry starts

---

### 2.5 Audio Quality Improvements

**Files to modify:**
- `src/features/gameplay/data/hitSounds.ts`
- `src/features/analysis/data/beatDSP.ts`
- `src/features/audio/data/audioDecoder.ts`

**Hit Sound Compressor:**
- Add `Tone.Compressor({ threshold: -20, ratio: 4, attack: 0.003, release: 0.1 })` before destination
- Route all hit synths through compressor → prevents clipping during rapid combos

**Combo Pitch Shift:**
- Subtle pitch increase with combo: base frequency × (1 + combo × 0.002)
- Cap at 1.5x pitch
- Resets on combo break

**BPM Range:**
- In `beatDSP.ts`: change lag scan from 70-190 BPM to 50-220 BPM
- Add octave error correction: if detected BPM < 70, try 2x; if > 180, try 0.5x

**File Validation:**
- In `audioDecoder.ts` or `SongUploadScreen.tsx`:
- Max file size: 50MB
- Accepted formats: `.mp3`, `.wav`, `.ogg`, `.m4a`, `.flac`, `.aac`
- Show error message for invalid files

---

## Phase 3: UI/UX Polish

*Smoothing out every screen and interaction.*

---

### 3.1 Song Upload Screen Improvements

**File:** `src/features/song-upload/presentation/SongUploadScreen.tsx`

- **File validation UI:** Show file size, format, duration estimate after selection
- **Error states:** Clear messages for wrong format, too large, decode failure
- **Difficulty descriptions:** Add brief text under each difficulty explaining what changes
  - Easy: "Relaxed pace, strong beats only"
  - Normal: "Balanced challenge, more notes"
  - Hard: "Fast patterns, offbeats included"
  - Expert: "Maximum density, triplets & syncopation"
- **Mode descriptions:** Explain classic (4 keys) vs trackpad (1 key/tap)
- **Animated idle state:** Subtle background animation (floating musical notes/particles)

---

### 3.2 Analyzing Screen Enhancement

**File:** `src/features/analysis/presentation/AnalyzingScreen.tsx`

- Show detected BPM live as analysis progresses
- Animated waveform visualization (simple canvas bars reacting to audio data)
- Show analysis stages with checkmarks: "Detecting tempo... Tracking beats... Generating notes..."
- Display confidence score when complete
- Show total note count for selected difficulty

---

### 3.3 Results Screen Upgrade

**File:** `src/features/scoring/presentation/ResultsScreen.tsx`

- **Staggered stat reveal:** Score → Accuracy → Max Combo → Grade, each animating in sequence with 300ms delay
- **Grade animation:** Grade letter drops in with bounce + particle burst
- **Timing histogram:** Small chart showing early/late distribution of all hits
- **Personal best comparison:** If same song+difficulty played before, show "+/- X" deltas
- **Action buttons:**
  - "RETRY" (replay same song, skip analysis)
  - "NEW SONG" (return to upload)
- **High score persistence:** Save top 10 scores per song hash to localStorage

---

### 3.4 In-Game HUD Improvements

**Files to modify:**
- `src/features/gameplay/presentation/scene/HUDRenderer.ts`
- `src/features/gameplay/presentation/scene/HitZoneRenderer.ts`

**New HUD elements:**
- **Song progress bar:** Thin horizontal bar at very top of screen showing playback position
- **Live accuracy %:** Small text below score, updates per hit
- **Early/Late indicator:** On each hit, show brief "EARLY" or "LATE" text (< perfect but within great/good window) to help players adjust timing

**Fix heartbeat BPM:**
- `HitZoneRenderer.ts` currently hardcodes `120` BPM for heartbeat pulse
- Pass actual `beatMap.bpm` through to renderer
- Pulse hit zone bar in sync with actual song tempo

---

### 3.5 Settings Persistence

**File:** `src/state/gameStore.ts`

- Use Zustand `persist` middleware with `localStorage`
- Persist: `mode`, `difficulty`, `highScores` (array per song hash)
- Do NOT persist: `phase`, `song`, `beatMap`, `currentTime`, `score`, `combo` (ephemeral state)
- On app load: restore last used mode and difficulty

---

## Phase 4: Graphics & Visual Upgrades

*Elevating the synthwave aesthetic with more juice and visual variety.*

---

### 4.1 Enhanced Note Visuals

**File:** `src/features/gameplay/presentation/scene/NoteRenderer.ts`

- **Per-lane note shapes:** Instead of all diamonds, use distinct shapes per lane:
  - Lane 0 (cyan): Circle
  - Lane 1 (magenta): Square
  - Lane 2 (yellow): Triangle
  - Lane 3 (green): Diamond
  - Helps players visually distinguish lanes instantly
- **BPM-synced glow:** Notes pulse glow radius to song BPM (subtle, 10% size oscillation)
- **Approach trail upgrade:** Gradient color trail that widens as note nears hit zone
- **Speed scaling:** Trail length adjusts based on note velocity (difficulty-dependent)

---

### 4.2 Background Upgrades

**File:** `src/features/gameplay/presentation/scene/BackgroundRenderer.ts`

- **Parallax starfield:** 2-3 layers of small dots at different scroll speeds behind the grid
- **Reactive grid color:** Grid tint shifts based on combo level:
  - 0-9: Purple (current)
  - 10-29: Cyan
  - 30-49: Magenta
  - 50-99: Gold
  - 100+: Rainbow cycling
- **Beat-reactive flash:** On each strong beat, brief brightness pulse on grid lines
- **Synthwave horizon:** Optional: simple mountain/city silhouette at ~30% height, neon sun half-circle

---

### 4.3 Lane Visual Improvements

**File:** `src/features/gameplay/presentation/scene/LaneRenderer.ts`

- **Vertical gradient:** Lane background fades from transparent at top to lane color (low alpha) at hit zone — guides the eye downward
- **Combo-reactive glow:** Lane edge glow intensity increases with combo
- **Speed lines:** At high combos (50+), add animated vertical streaks on lane edges (sense of velocity)

---

### 4.4 Hit Feedback Juice

**Files to modify:**
- `src/features/gameplay/presentation/scene/HitFeedbackRenderer.ts`
- `src/features/gameplay/presentation/scene/HitZoneRenderer.ts`

**Perfect hit enhancement:**
- Expanding ring shockwave from hit point (concentric circles, fading outward)
- Brief white vignette flash at screen edges (50ms)
- More particles (30 instead of 20)

**Combo milestones (50, 100, 200...):**
- Full-width celebration text ("INCREDIBLE!", "UNSTOPPABLE!", "LEGENDARY!")
- Screen-wide particle burst (confetti-like, multicolor)
- Brief screen zoom pulse (scale 1.02 → 1.0 over 200ms)

**BPM-synced hit zone:**
- Hit pads bounce subtly to actual song BPM (not hardcoded 120)
- Bounce amplitude increases slightly with combo

---

### 4.5 Post-Processing Polish

**File:** `src/features/gameplay/presentation/scene/EffectsController.ts`

- **Chromatic aberration on miss:** Brief RGB channel split (2px offset, 100ms) — adds punch to miss feedback
- **Dynamic bloom:** Bloom intensity scales with combo: 1.0 (base) + combo × 0.005 (capped at 2.5)
- **CRT toggle:** Allow players to toggle CRT effect on/off (some prefer clean look, especially on mobile where scanlines can look muddy on small screens)
- **Mobile optimization:** Auto-disable CRT and reduce bloom on mobile for performance

---

## Phase 5: Quality & Performance

*Ensuring smooth 60fps across all devices.*

---

### 5.1 Object Pooling

**Files to modify:**
- `src/features/gameplay/presentation/scene/NoteRenderer.ts`
- `src/features/gameplay/presentation/scene/HitFeedbackRenderer.ts`

**Note Pool:**
- Pre-allocate pool of 50 note sprite groups (sprite + glow + trail)
- On spawn: acquire from pool, configure, add to stage
- On despawn: remove from stage, reset, return to pool
- Eliminates GC spikes from constant create/destroy during gameplay

**Particle Pool:**
- Pre-allocate pool of 200 particle sprites
- Reuse across all judgment effects
- Cap active particles at 100 on mobile, 200 on desktop

---

### 5.2 Mobile Performance Tier

**Files to modify:**
- `src/features/gameplay/presentation/scene/EffectsController.ts`
- `src/core/lib/PixiApp.ts`

**Detection:**
- Check `navigator.maxTouchPoints > 0` as basic mobile indicator
- Check `window.devicePixelRatio` — cap canvas resolution at 2x on mobile
- Optionally check GPU via `PIXI.utils.isWebGLSupported()` capabilities

**Mobile adjustments:**
- Disable CRT filter (expensive on mobile GPU)
- Reduce bloom blur from 4 to 2
- Disable glitch filter entirely
- Reduce max particles by 50%
- Simplify note trails (shorter, no gradient)

---

### 5.3 Haptic Feedback

**File:** `src/features/gameplay/presentation/useInputManager.ts`

- On successful hit: `navigator.vibrate?.(10)` (10ms tap)
- On perfect: `navigator.vibrate?.([5, 5, 5])` (triple tap pattern)
- On miss: `navigator.vibrate?.(30)` (longer buzz)
- On combo break: `navigator.vibrate?.([50, 30, 50])` (double buzz)
- Only call if `navigator.vibrate` exists (Safari doesn't support it — no-op)

---

## Implementation Priority

| Priority | Phase | Effort | Impact |
|----------|-------|--------|--------|
| 1 (NOW)  | 1.1 Touch Input | Medium | Game unplayable without it |
| 2 (NOW)  | 1.2 Viewport/Safe Area | Small | Broken layout on mobile |
| 3 (NOW)  | 1.4 Safari Audio | Small | No sound on iPhone |
| 4        | 1.3 Orientation | Small | Bad UX in portrait |
| 5        | 2.4 Pause & Retry | Medium | Essential game feature |
| 6        | 3.4 HUD (fix BPM) | Small | Bug fix, quick win |
| 7        | 3.5 Settings Persist | Small | QoL, quick win |
| 8        | 3.1 Upload Validation | Small | Prevents crashes |
| 9        | 2.5 Audio Improvements | Medium | Sound quality |
| 10       | 4.2 Background Upgrades | Medium | Visual wow factor |
| 11       | 4.4 Hit Feedback Juice | Medium | Game feel |
| 12       | 2.2 Fever Mode | Medium | Engagement |
| 13       | 2.1 Long Notes | Large | Gameplay variety |
| 14       | 4.1 Note Shapes | Medium | Visual clarity |
| 15       | 2.3 Miss Feedback | Medium | Game feel |
| 16       | 3.3 Results Upgrade | Medium | Polish |
| 17       | 5.1 Object Pooling | Medium | Performance |
| 18       | 5.2 Mobile Perf Tier | Medium | Mobile stability |
| 19       | 1.5 Fullscreen | Small | Immersion |
| 20       | 1.6 PWA | Medium | Installability |
| 21       | 5.3 Haptic Feedback | Small | Mobile polish |
| 22       | 4.5 Post-Processing | Medium | Visual polish |
| 23       | 3.2 Analyzing Screen | Small | Polish |
| 24       | 4.3 Lane Visuals | Medium | Polish |

---

## Verification Plan

### Testing Checklist
- [ ] **iPhone Safari:** Touch input works, audio plays, safe area handled, no zoom on double-tap
- [ ] **Chrome Android:** Touch input, haptic feedback, fullscreen mode
- [ ] **Desktop Chrome/Firefox/Safari:** Keyboard input unchanged, all visual effects work
- [ ] **Performance:** 60fps on iPhone SE (low-end) during full gameplay
- [ ] **Audio:** No clipping at 100+ combo, Safari autoplay handled, hit sounds audible
- [ ] **PWA:** Installable from browser, correct icon and splash screen
- [ ] **Pause/Retry:** Pause overlay works, retry resets correctly, no audio desync

### Automated Tests
- `npx vitest run` — all existing tests pass
- New tests for: touch lane mapping, hold note judgment, fever mode activation, file validation
- Test locations: `src/features/gameplay/domain/__tests__/`, `src/features/scoring/domain/__tests__/`
