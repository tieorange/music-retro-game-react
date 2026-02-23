# UI/UX & Graphics Improvement Plan — PixelBeat (v2)

> **Goal:** Make PixelBeat the most satisfying, _approachable_, rhythm game you can play in a browser. Every tap must feel powerful, every miss must sting, and a first-time player must understand the game in 5 seconds.

---

## Philosophy

### 1. JUICE — Make every action feel alive
Every player action → immediate visual **AND** audio response. High performance should feel _dramatically_ different from low performance. The environment itself reacts to the player's skill.

### 2. USABILITY — Respect the player's time
A beautiful game nobody can play is worthless. Before adding particle effects, nail these:
- **Latency**: Input → visual feedback in < 16ms (one frame). Hit sounds fire within the same audio frame.
- **Readability**: Notes, lanes, and the hit zone must be instantly parseable even during visual chaos (FEVER, particles, screen shake).
- **Onboarding**: A first-time player with no instructions should instinctively know what to do within the first 3 notes.
- **Calibration**: Provide an audio latency offset option. Different machines/headphones introduce variable delay.

### 3. PROGRESSIVE COMPLEXITY — Reward skill with spectacle
Don't overwhelm beginners. Start visually calm, let the player's performance unlock the fireworks. Cold → Warm → Hot → Blazing → PERFECT GROOVE.

---

## Sprint 1 — Core Game Feel ("Every tap feels incredible")

> These changes affect **every single interaction**. They have the highest fun-per-line-of-code ratio.

---

### 1.1 Hit Feedback Particles + Judgment Text

**New file: `HitFeedbackRenderer.ts`**

| Judgment | Particles | Text | Screen Effect |
|----------|-----------|------|---------------|
| **PERFECT** | 20 gold sparks in starburst | `PERFECT!` gold, scale 150%→100%, float up 80px, fade | Screen edges flash gold 80ms |
| **GREAT** | 12 cyan sparks arcing up | `GREAT` cyan, float up 60px, fade | Lane column flashes white→cyan |
| **GOOD** | 8 green sparks in arc | `GOOD` green, float up 40px, fade | Lane tints green briefly |
| **MISS** | 4 red shards down | `MISS` red, stamped (no float), fades 500ms | Red vignette + screen shake ±5px + glitch tear on lane |

**Score popup numbers:** `+300`, `+200`, `+100` appear above the struck lane. Color matches judgment. Floats up 50px, fades over 700ms. Scale snap: 80%→120%→100% in 80ms. When multiplier active: `+300 ×4` with smaller sub-label.

**Near-miss feedback:** Player presses within 150ms of a note but outside "good" window → `CLOSE...` in orange-yellow, transparent. Small wobble (±2px, 200ms). No score — just encouragement. Ghost press (no note nearby) → quick dim flash on that lane only.

### 1.2 Lane Key-Press Flash + Lane Tension

**Modify: `LaneRenderer.ts`**

- **Key press lighting**: Full column brightens on _any_ key press (even with no note) — confirms input is registered. Brightness decays over 150ms.
- **Lane tension**: As a note approaches the hit zone (within 300ms), the lane gradually brightens 30%→100% opacity. On hit: instant release flash. On miss: tension snaps — lane flashes red, dims.
- **Key labels**: D / F / J / K float just above the hit zone pads. Bright white on press, dimmed at rest. Tiny, non-distracting. Essential for onboarding.
- **Separator lines**: Ultra-thin (1px), semi-transparent between lanes. Slow sinusoidal pulse (2s period, 30–60% opacity).

### 1.3 Hit Zone Beat Heartbeat

**Modify: `HitZoneRenderer.ts`**

The hit zone is the most-watched element. It must feel like a living surface:
- **Base**: Gradient band from lane 0 color (left) to lane 3 color (right), 20% opacity.
- **Bright edge**: Crisp 2px white line along the top edge.
- **Per-lane pad indicators**: Four rounded rectangles, one per lane:
  - Rest: faint lane-color glow (40% opacity).
  - Key press: flash to full brightness.
  - PERFECT: scale-up pulse.
  - MISS: crack and flash red.
- **Burst rings**: On hit, a translucent ring expands outward from impact point at that lane. PERFECT = large, GOOD = small.
- **Beat heartbeat**: Entire bar pulses on each beat (30ms brightness spike, 150ms decay). This makes the target feel alive and helps players internalize the tempo.

### 1.4 Hit Sounds (Tone.js)

**New file: `hitSounds.ts`**

> More impactful than any visual change for game-feel. This is the single most underrated improvement.

Three tiers, generated procedurally with Tone.js (short synth stabs):
- **PERFECT**: Short high-pitched metallic "TING" (sine wave, short decay, slight reverb). Gold and clean.
- **GREAT**: Mid-frequency "CLICK" (slightly percussive, quick). Confident.
- **GOOD**: Softer "TICK". Acceptable.
- **MISS**: Low "THUD" with slight reverb. Unmistakable.

Hit sounds play at ~20% of music volume — present but not overwhelming. Mixed _below_ the song.

**Combo milestone sounds:**
- 10: Quick ascending 3-note chime
- 30: Synth chord stab
- 50 / FEVER: Dramatic rising synth sweep + boom
- 100: Big synth chord, long reverb
- Combo break: Descending "womp womp" (2 notes falling)

### 1.5 Note Visual Overhaul

**Modify: `NoteRenderer.ts`**

- **Glow + trail**: Colored fill (lane color) + white inner diamond + thick outer glow (lane color, 40% opacity). Gradient streak behind each note — bright at note, transparent 60px back.
- **Spawn animation**: Pop in from scale 0→1.2→1.0 over 40ms (bubble pop).
- **Approach fade**: Start at 30% opacity at top, reach 100% by halfway.
- **Beat-strength intensity**: Notes on strong beats glow brighter + thicker trails.
- **Danger flash**: When a note is 100ms from auto-miss, it flashes red/amber rapidly (4 flashes). Last-chance warning.

### 1.6 Countdown Overlay

**Modify: `GameplayScreen.tsx`**

Before gameplay begins:
- Full-screen dark overlay.
- `3` → `2` → `1` → `GO!` — each number slams in from 200%→100% scale with bounce + screen flash:
  - `3` = red, `2` = yellow, `1` = green, `GO!` = gold explosion + particle burst + overlay removed.
- Hit zone pads light up in sequence on each count (reinforces BPM timing).
- Subtle Tone.js synth tone per number (ascending pitch).

### 1.7 Combo Counter Redesign

**Modify: `HUDRenderer.ts`**

- Position: top-center, largest HUD element.
- Growth curve: combo 1–9 (small) → 10–29 (medium) → 30–49 (large) → 50+ (very large, glowing).
- Color progression: white → cyan → magenta → gold → rainbow at 100+.
- Shatter on break: each digit sprite explodes outward in a random direction, fades.
- Score display: top-right, counter lerps toward target score ("slot machine" feel). Scale bounce 1.0→1.15→1.0 on score increase.
- Full Combo indicator: golden "FC" badge in top-left, shatters with particle burst if broken.

---

## Sprint 2 — Meta-Game & Identity ("The game transforms")

> These features add a progression arc _within_ each session. Performance changes the world.

---

### 2.1 Perspective Highway

**Modify: `LaneRenderer.ts` + `BackgroundRenderer.ts`**

Replace flat vertical lanes with a **vanishing-point perspective projection**:

```
Current (flat):                    New (perspective highway):
                                          |  |  |  |
  [L0][L1][L2][L3]                        | || || |
  ════════════════                       / || || | \
  ════════════════               -------/--||--||--\-------  ← horizon
  ════════════════              /       /  ||  ||  \        \
  ══════[HIT]═════             /       /   |    |   \        \
                               ════════════[HIT ZONE]══════════
```

- Notes spawn tiny at the top (distance), grow as they fall toward the player.
- Lane lines converge to vanishing point. Scale formula: `scale = BASE_SCALE / (1 + distance * PERSP_FACTOR)`.
- **The Horizon** (top ~25% of screen):
  - Sky gradient: deep indigo → dark purple → near-black.
  - ~60 stars that drift slowly (parallax 0.05×).
  - City silhouette: faint neon-outlined cityscape at horizon line (Pixi.js Graphics).
  - Horizon glow: soft radial gradient (pink/orange) at vanishing point, pulses on every beat.
- **Road markings**: Dashed white lines scroll toward the player at BPM-matched speed. Brighten on the beat.
- **Perspective-scaled notes**: ~12px at top, ~28px near hit zone. Makes timing visually intuitive.

### 2.2 FEVER MODE

**New file: `FeverRenderer.ts`**

When combo reaches 50, the game enters FEVER MODE — a completely different visual state.

**Activation:**
- `FEVER!!` banner slams in from left, bounces, settles (orange-red with fire glow).
- Sky shifts to fire gradient (deep red → orange → yellow at horizon).
- City silhouette turns red/orange.
- Warm color-grade overlay (15% orange).

**While active:**
- Notes 20% larger, trails 2× length, pulse 2× frequency.
- Hit zone bar blazes: fire particles along bottom edge.
- Road dashes become orange fire streaks.
- Speed lines at left/right screen edges.
- Background scroll speed +30%.
- Canvas breathes: 1.0→1.003→1.0 on each beat.
- PERFECT particles increased to 28.

**Deactivation (on miss):**
- Screen flashes icy blue for 2 frames.
- Frost particles burst from hit zone.
- `FEVER BROKEN` in faded blue.
- Background returns to normal over 1s.

**Score:** All judgments × 1.5 additional multiplier during FEVER.

### 2.3 GROOVE METER

**New file: `GrooveMeterRenderer.ts`**

Vertical bar on the left edge. Fills on PERFECT/GREAT, drains on MISS/GOOD. Five tiers that physically change the game world:

| Tier | Meter | Background | Notes | Sky |
|------|-------|-----------|-------|-----|
| COLD | 0–20% | Dark, near-black, slow scroll | Small, dim | Pitch black |
| WARM | 20–40% | Normal purple grid | Normal | Dark indigo |
| HOT | 40–70% | Grid brighter, faster scroll | Normal + pulse | Stars appear |
| BLAZING | 70–90% | Grid flashing, trails on lines | Larger, brighter | Stars + shooting stars |
| PERFECT GROOVE | 90–100% | Rainbow color shift | Max glow/trails | Full horizon glow |

**PERFECT GROOVE state:** Rainbow-cycle overlay (10% opacity), rainbow note trails, shimmer hit zone, ambient particles rising from bottom, "PERFECT GROOVE" badge top-right.

### 2.4 PERFECT Chain Tracker

Separate counter: consecutive PERFECTs only.
- 5 in a row: `PERFECT CHAIN ×5` in gold above combo, shrinks to persistent badge.
- 10 in a row: badge gets animated shimmer ring.
- 20 in a row: `UNSTOPPABLE` banner slams across screen, fades to indicator.
- Breaking the chain: badge shatters and disappears.

### 2.5 Combo Milestone Explosions

| Combo | Effect |
|-------|--------|
| 10 | Gold shimmer wave sweeps left-to-right |
| 20 | Background grid massive brightness spike |
| 30 | 5 shooting stars across sky + `COMBO ×30!` |
| 50 | FEVER activates |
| 100 | White flash → `×100 LEGENDARY` rainbow text explodes outward |
| Every +50 | Smaller version of 100 effect, color shifts |

**Combo break:**
- Digits fly apart in random directions (each digit is a sprite), fade over 600ms.
- Red crack graphic on hit zone for 300ms.
- Camera shake ±6px, 200ms.
- Multiplier badge implodes inward.

### 2.6 Beat-Reactive Background

**Modify: `BackgroundRenderer.ts`**

- Every beat: brightness wave travels down the highway from horizon to player (~200ms).
- Every downbeat (4th): road marking flash + camera micro-breathe.
- Every 4 bars (in combo): brief rainbow shimmer.
- Song climax detection: high beat-strength sections → brighter background, extra sky particles. Low-energy → dims, scroll slows. The game world breathes with the song.

### 2.7 Dynamic CRT & Retro Effects

**Modify: `effects.ts`**

- Scanline intensity increases during misses (screen "stresses").
- Film grain: 5% intensity, barely perceptible, adds texture.
- Chromatic aberration: slight RGB split (1-2px), intensifies on miss, resets.
- Bloom: strong enough for authentic neon glow. On PERFECT: bloom briefly maxes (80ms).
- FEVER color grade overlay.

---

## Sprint 3 — Polish & Personality ("The complete experience")

> Screen-by-screen polish, personality features, accessibility.

---

### 3.1 Song Upload Screen Polish

- **Title treatment**: Letters appear with 40ms stagger, bouncing from above. Cycle through neon colors independently. Idle bob animation.
- **Drop zone**: Neon dashed border with slow pulse. File dragged over → solid bright cyan + corner sparks. Valid drop → green flash.
- **Difficulty cards**: Full cards with name + description. Hover: lift + glow + flicker. Selected: active outline + inner glow + "SELECTED" badge. Stagger in from below.
- **Attract mode**: Ghost gameplay at 30% opacity behind the UI. Showcases visuals silently.

### 3.2 Analyzing Screen Polish

- Oscilloscope-style waveform: processed portion colored, unprocessed dim.
- Pixel-art spinning vinyl record.
- Stage labels: typewriter animation (~40ms per char).
- Beat markers: cyan dots on waveform as beats are detected.

### 3.3 Results Screen Grade Reveal Ceremony

- Suspense build: 800ms dark hold.
- Grade slams in from 300%→100%, bounce easing:
  - **S**: Gold + white flash + confetti/stars + `S-RANK PERFECT!` fanfare.
  - **A**: Cyan sweep + upward streaks.
  - **B**: Green glow + pulse from center.
  - **C**: Blue fade-in.
- Stats: sequential reveal (150ms stagger), slide in from right + fade. Numbers count up from 0 over 600ms.
- Accuracy bar fills left→right over 800ms.
- Performance breakdown: stacked bar (gold/cyan/green/red), fills over 1000ms.
- Achievements: "NEW RECORD ★", "FULL COMBO", "PERFECT ACCURACY", "FEVER KING".

### 3.4 Song End Explosion

- Final note → MASSIVE all-color particle burst.
- Background: white→black over 500ms.
- Lane glows pulse outward like a shockwave.
- Screen shake 300ms.
- Scan-wipe transition to results.

### 3.5 Auto-Miss Avalanche

3+ misses in rapid succession:
- Red flash on each miss.
- Escalating camera shake.
- Low ominous hum.

### 3.6 Song Intro Phase

First 3 seconds (before notes arrive):
- Camera zooms in from 0.85×→1.0×.
- Background fades up from black.
- Hit zone pads blink in sequence (startup sequence).
- BPM-synced flashes prepare the player for tempo.
- First note: 500ms telegraph spotlight + "HERE IT COMES" arrow.

### 3.7 Pixel Dancer Character

Small pixel-art character (~60×80px) in bottom-left corner:
- Idle: gentle sway (2 frames).
- GOOD: arm pump. GREAT: both arms up. PERFECT: full spin. MISS: slumps.
- FEVER: runs in place. Song end S-rank: victory pose + sparkle.

### 3.8 Live Frequency Analyzer

16-bar spectrum analyzer below the hit zone.
- Max 20px tall, neon colored (bass=cyan, treble=magenta).
- Uses `AnalyserNode` for real-time reactivity.

### 3.9 Audience Silhouettes

Behind the city silhouette: faint audience shapes.
- Low groove: still. Mid groove: sway. High/FEVER: hands up, jumping.

---

## Usability Foundations (Apply throughout all sprints)

### Input Calibration
- Settings option: audio latency offset (±50ms). Different hardware introduces delay.
- Visual calibration tool: play 8 beats, tap along, auto-calculate offset.

### Accessibility
- **Color-blind mode**: Per-lane shapes (circle / diamond / square / triangle) instead of color-only.
- **Hit sound volume**: Slider for hit sound vs music ratio.
- **Effects intensity**: Low / High. Low disables camera shake, screen flash, chromatic aberration.
- **Note speed**: 0.5× / 1.0× / 1.5× / 2.0× — wider timing window for slower, tighter for faster.

### Readability During Chaos
- All particle effects: `alpha: 0` when within 20px of an active note (never obscure gameplay).
- Judgment text: renders in a separate layer above particles.
- Hit zone always remains at full visibility regardless of effects.

---

## Color Palette

```css
/* Judgments */
--color-perfect:      #ffd700;   /* gold */
--color-great:        #00ffff;   /* cyan */
--color-good:         #00ff00;   /* green */
--color-miss:         #ff3333;   /* red */
--color-close:        #ff9900;   /* orange */

/* Grades */
--color-grade-s:      #ffd700;
--color-grade-a:      #00ffff;
--color-grade-b:      #00ff00;
--color-grade-c:      #6699ff;

/* Lanes */
--color-lane-0:       #00ffff;   /* cyan */
--color-lane-1:       #ff00ff;   /* magenta */
--color-lane-2:       #ffff00;   /* yellow */
--color-lane-3:       #00ff00;   /* green */

/* States */
--color-fever:        #ff6600;
--color-fever-dark:   #cc2200;
--color-groove-cold:  #222244;
--color-groove-hot:   #cc44ff;
--color-groove-max:   /* rainbow: CSS animation cycling hue */;

/* Background */
--color-sky-top:      #000011;
--color-sky-horizon:  #1a0033;
--color-horizon-glow: #ff44aa;
--color-city:         #110022;
```

## Typography

- **Gameplay HUD**: Press Start 2P — retro identity.
- **Judgment text**: Press Start 2P + thick drop shadow + blur glow.
- **Menu body**: System monospace fallback.
- **Grade letter**: Press Start 2P at massive scale (20–30% screen height).
- **FEVER/milestone banners**: letter-spacing `0.2em`.

## Animation Principles

- **Screen transitions**: Neon scan-wipe (2px cyan line sweeps in 180ms). Not fade-in/fade-out.
- **Camera breathe**: On downbeat 1.0→1.002→1.0 (barely perceptible). FEVER: 1.0→1.005→1.0.
- **Camera shake on MISS**: ±5px, 6 oscillations, 200ms, decaying amplitude.
- **Framer Motion (React screens)**: Stagger children 80ms. Spring physics for grade reveal (stiffness: 200, damping: 15). Exit: slide-left.

---

## Non-Goals (Stay focused)

- 3D WebGL rendering (keep Pixi.js 2D + perspective illusion)
- Changing beat detection algorithm
- New game modes or mechanics
- Multiplayer
- Mobile/touch-first UI (separate effort)
- External sprite assets (keep procedural Pixi.js graphics)
