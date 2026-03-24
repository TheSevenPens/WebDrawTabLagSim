# Architecture

Svelte 5 + Vite single-page app that animates drawing tablet lag using HTML5 Canvas. Deployed to GitHub Pages via GitHub Actions.

## File Structure

```
index.html                      — Vite entry point (minimal shell)
package.json                    — Dependencies: svelte, vite, @sveltejs/vite-plugin-svelte
vite.config.js                  — Vite config with Svelte plugin and GitHub Pages base path
svelte.config.js                — Svelte preprocessor config
src/
├── main.js                     — Mounts Svelte app to #app
├── App.svelte                  — Root component: holds all $state, composes layout
├── app.css                     — Global styles (body, reset)
├── components/
│   ├── Canvas.svelte           — Canvas element, render loop, double buffering
│   ├── SidePanel.svelte        — Legend + visibility checkboxes + pointer style dropdown
│   ├── Slider.svelte           — Reusable slider control
│   └── Controls.svelte         — Bottom slider bar (5 sliders)
└── lib/
    ├── constants.js            — Colors, font, sizes, offsets, buffer limits
    ├── simulation.js           — Lag pipeline: delay + EMA smoothing for B and C
    ├── animation.js            — Lissajous path, deterministic track pre-computation
    └── drawing.js              — All canvas drawing primitives
.github/workflows/deploy.yml   — GitHub Actions: build and deploy to Pages
ARCHITECTURE.md                 — This file
FUTURES.md                      — Ideas for improvements
```

## Layout

```
┌─────────────────────────────────────────────────┐
│                    Title                         │
├──────────────┬──────────────────────────────────┤
│  Side Panel  │            Canvas                 │
│  - Legend    │       (animation area)            │
│  - Toggles   │                                   │
├──────────────┴──────────────────────────────────┤
│              Sliders (HTML)                      │
└─────────────────────────────────────────────────┘
```

- **Side Panel** (left, `SidePanel.svelte`): Legend and all checkbox/dropdown controls stacked vertically.
- **Canvas** (center-right, `Canvas.svelte`): Double-buffered `<canvas>` for animation.
- **Sliders** (bottom, `Controls.svelte`): Pointer Latency, Pointer Smoothing, Brush Latency, Brush Smoothing, Pen Speed.

## Lag Model

Each stage in the pen-to-display pipeline has two parameters:

| Parameter | Effect |
|---|---|
| **Latency** | Pure time delay in frames — B sees A's position from N frames ago |
| **Smoothing** | EMA (exponential moving average) filter strength — rounds corners, shrinks the path |

The EMA formula: `output = α × input + (1 − α) × prev_output` where `α = 1 / (1 + smoothing)`. When smoothing=0, α=1, so B follows A's exact path (just delayed). When smoothing>0, B traces a tighter, corner-cutting path.

### Pipeline

```
A (pen tip) ──[pointer latency + pointer smoothing]──→ B (OS pointer)
B (OS pointer) ──[brush latency + brush smoothing]──→ C (brush stroke)
```

## Deterministic Tracks

Because A follows a periodic Lissajous curve, the steady-state paths of B and C are also periodic and fully deterministic for any given parameter set. The app pre-computes these tracks:

1. **Track A**: Sample one full Lissajous period at the runtime step rate.
2. **Track B**: Run A's track through the delay + EMA pipeline for several warm-up periods, keep the last period.
3. **Track C**: Run B's track through C's delay + EMA pipeline the same way.

Tracks are recomputed reactively via `$effect` whenever latency, smoothing, or pen speed props change. Track B is only displayed when pointer smoothing > 0 (otherwise identical to Track A). Same for Track C.

## State Management

All mutable state lives in `App.svelte` as Svelte 5 `$state()` runes:

```
pointerLatency, pointerSmoothing    — Pointer lag parameters
brushLatency, brushSmoothing        — Brush lag parameters
penSpeed                            — Animation speed
showA, showB, showC                 — Label visibility
showPointer, pointerStyle           — OS pointer visibility and style
showCircleA/B/C                     — Dotted circle visibility
showTrackA/B/C                      — Track visibility
```

State flows down via props. `SidePanel` and `Controls` use `bind:` for two-way binding. `Canvas` receives read-only props.

## Module Responsibilities

### `src/lib/constants.js`
Centralized config: `COLORS` (separate named colors for A/B/C), `FONT`, `LABEL_OFFSETS`, `CIRCLE_RADII`, `HISTORY_SIZE`, `BRUSH_TRAIL_MAX`, `TIME_STEP_SCALE`.

### `src/lib/simulation.js`
Models the runtime lag pipeline. **Framework-agnostic** — accepts params explicitly, no Svelte imports. Maintains module-level mutable state (EMA accumulators, history buffers). Key exports: `pushHistory`, `pushBrushTrail`, `computeCurrentPositions(W, H, params)`, `preWarm(W, H, params)`.

### `src/lib/animation.js`
Deterministic path and track computation: `autoPosition(t, W, H)` for the Lissajous curve (frequencies 2:3), `computeTrackA(W, H, penSpeed)`, `computeSmoothedTrack(inputTrack, latency, smoothing)`.

### `src/lib/drawing.js`
All canvas drawing primitives: pen, pointer, crosshair, dashed circles, labels, brush stroke, tracks. Pure functions taking `ctx` + coordinates.

### `src/components/Canvas.svelte`
The most complex component. Uses `onMount` for canvas setup, double buffering, pre-warm, and `requestAnimationFrame` loop. Uses `$effect` to reactively recompute tracks when lag/speed props change. The render loop itself is imperative (runs every frame), reading current prop values directly.

### `src/components/SidePanel.svelte`
Legend text + checkbox/dropdown controls. All toggle props use `$bindable()`.

### `src/components/Slider.svelte`
Reusable slider: label + range input + value display. Bindable `value` prop.

### `src/components/Controls.svelte`
Composes five `Slider` instances with bindable props.

### `src/App.svelte`
Root component. Declares all `$state()` runes. Composes `SidePanel`, `Canvas`, `Controls` with `bind:` directives.

## Data Flow

```
penSpeed → time increment → autoPosition(time) → posA
                                                    ↓
                                              posHistory[]
                                                    ↓
                             pointerLatency → getDelayedPos() → EMA(pointerSmoothing) → posB
                                                                                          ↓
                                                                                    posBHistory[]
                                                                                          ↓
                                              brushLatency → getBDelayedPos() → EMA(brushSmoothing) → posC
                                                                                                        ↓
                                                                                                  brushTrail[]
                                                                                                        ↓
                                                                                                drawBrushStroke()
```

## Build & Deploy

- **Dev**: `bun run dev` (or `npm run dev`) — Vite dev server with HMR
- **Build**: `bun run build` — produces optimized static files in `dist/`
- **Deploy**: Push to `main` → GitHub Actions builds and deploys to GitHub Pages at `/WebDrawTabLagSim/`

## Module Dependency Graph

```
App.svelte
├── Canvas.svelte
│   ├── lib/constants.js
│   ├── lib/simulation.js ─── lib/constants.js, lib/animation.js
│   ├── lib/drawing.js ────── lib/constants.js
│   └── lib/animation.js ──── lib/constants.js
├── SidePanel.svelte
└── Controls.svelte
    └── Slider.svelte
```
