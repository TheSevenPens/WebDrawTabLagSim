# Architecture

Svelte 5 + Vite single-page app that animates drawing tablet lag using HTML5 Canvas (HiDPI-aware). Deployed to GitHub Pages via GitHub Actions.

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
│   ├── Canvas.svelte           — Canvas element, render loop, double buffering, HiDPI
│   ├── SidePanel.svelte        — Legend + visibility checkboxes + pointer style dropdown
│   ├── Slider.svelte           — Reusable slider control (label + range + value)
│   ├── LatencySmoothing.svelte — Grouped latency + smoothing slider pair
│   └── Controls.svelte         — Bottom control bar (slider groups + path selector)
└── lib/
    ├── constants.js            — Colors, font, sizes, offsets, buffer limits
    ├── simulation.js           — Lag pipeline: delay + EMA + report rate for B and C
    ├── animation.js            — Path functions (Lissajous, Circle, Star), track pre-computation
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
│              Controls (HTML)                     │
│  [Pointer Lat+Smooth] [Brush Lat+Smooth]        │
│  [Pen Speed] [Brush Size] [Report Rate] [Path]  │
└─────────────────────────────────────────────────┘
```

- **Side Panel** (left, `SidePanel.svelte`): Legend and all checkbox/dropdown controls stacked vertically.
- **Canvas** (center-right, `Canvas.svelte`): Double-buffered HiDPI `<canvas>` for animation.
- **Controls** (bottom, `Controls.svelte`): Grouped sliders and path selector.

## Lag Model

Each stage in the pen-to-display pipeline has two parameters:

| Parameter | Effect |
|---|---|
| **Latency** | Pure time delay in frames — B sees A's position from N frames ago |
| **Smoothing** | EMA (exponential moving average) filter strength — rounds corners, shrinks the path |

The EMA formula: `output = α × input + (1 − α) × prev_output` where `α = 1 / (1 + smoothing)`. When smoothing=0, α=1, so B follows A's exact path (just delayed). When smoothing>0, B traces a tighter, corner-cutting path.

### Report Rate

In addition to latency and smoothing, point B is governed by a **report rate** that simulates the tablet's hardware update frequency. The animation runs at ~60fps, but B only updates its position on "report frames" determined by the report rate. Between reports, B holds its last position. This creates visible stepping/jumping at low report rates (e.g., 2-5 Hz), faithfully modeling how low-frequency tablets behave.

### Pipeline

```
A (pen tip) ──[report rate → pointer latency + pointer smoothing]──→ B (OS pointer)
B (OS pointer) ──[brush latency + brush smoothing]──→ C (brush stroke)
```

## Path Types

The pen tip (A) can follow different deterministic paths, selectable via dropdown:

| Path | Description |
|---|---|
| **Lissajous** | Parametric curve with frequency ratio 2:3, creates a pretzel shape |
| **Circle** | Simple elliptical orbit |
| **Star** | Pentagram — pen moves directly between the 5 star points in skip-one order |

All paths share the same period (2π) and are centered on the canvas with configurable amplitude.

## Deterministic Tracks

Because A follows a periodic path, the steady-state paths of B and C are also periodic and fully deterministic for any given parameter set. The app pre-computes these tracks:

1. **Track A**: Sample one full period at the runtime step rate.
2. **Track B**: Run A's track through the delay + EMA pipeline for several warm-up periods, keep the last period.
3. **Track C**: Run B's track through C's delay + EMA pipeline the same way.

Tracks are recomputed reactively via `$effect` whenever latency, smoothing, pen speed, or path type change. Track B is only displayed when pointer smoothing > 0 (otherwise identical to Track A). Same for Track C and brush smoothing.

## HiDPI Rendering

The canvas backing store is sized at `logicalWidth × dpr` by `logicalHeight × dpr` (where `dpr = devicePixelRatio`), while CSS dimensions remain at logical size. Each frame applies `ctx.setTransform(dpr, 0, 0, dpr, 0, 0)` so all drawing code uses logical coordinates. The transform is reset before blitting the offscreen buffer.

## State Management

All mutable state lives in `App.svelte` as Svelte 5 `$state()` runes:

```
pointerLatency, pointerSmoothing    — Pointer lag parameters
brushLatency, brushSmoothing        — Brush lag parameters
penSpeed                            — Animation speed (0.5–10, step 0.5)
pathType                            — Path shape: 'lissajous' | 'circle' | 'star'
brushSize                           — Brush stroke scale factor (0.1–3)
reportRate                          — Tablet report rate in Hz (1–60)
showA, showB, showC                 — Label visibility
showPointer, pointerStyle           — OS pointer visibility and style (mouse/crosshair)
showCircleA/B/C                     — Dotted circle visibility
showTrackA/B/C                      — Track visibility
showBrushStroke                     — Brush stroke visibility
```

State flows down via props. `SidePanel` and `Controls` use `bind:` for two-way binding. `Canvas` receives read-only props.

## Module Responsibilities

### `src/lib/constants.js`
Centralized config: `COLORS` (separate named colors for A/B/C), `FONT`, `LABEL_OFFSETS`, `CIRCLE_RADII`, `HISTORY_SIZE`, `BRUSH_TRAIL_MAX`, `TIME_STEP_SCALE`.

### `src/lib/simulation.js`
Models the runtime lag pipeline. **Framework-agnostic** — accepts params explicitly, no Svelte imports. Maintains module-level mutable state (EMA accumulators, history buffers, report rate frame counter). Key exports: `pushHistory`, `pushBrushTrail`, `computeCurrentPositions(W, H, params)`, `preWarm(W, H, params)`.

### `src/lib/animation.js`
Path functions (`lissajousPosition`, `circlePosition`, `starPosition`) and the unified `autoPosition(t, W, H, pathType)` dispatcher. Track pre-computation: `computeTrackA(W, H, penSpeed, pathType)`, `computeSmoothedTrack(inputTrack, latency, smoothing)`.

### `src/lib/drawing.js`
All canvas drawing primitives: pen, pointer (mouse icon), crosshair (white with black outline), dashed circles, labels, brush stroke (with configurable size), tracks. Pure functions taking `ctx` + coordinates.

### `src/components/Canvas.svelte`
The most complex component. Uses `onMount` for canvas setup, HiDPI scaling, double buffering, pre-warm, and `requestAnimationFrame` loop. Uses `$effect` to reactively recompute tracks when lag/speed/path props change.

### `src/components/SidePanel.svelte`
Legend text + checkbox/dropdown controls. All toggle props use `$bindable()`.

### `src/components/Slider.svelte`
Reusable slider: label + range input (with configurable step) + value display to the right. Bindable `value` prop.

### `src/components/LatencySmoothing.svelte`
Composite component: groups a Latency slider and a Smoothing slider under a shared label. Used for both the Pointer and Brush control groups.

### `src/components/Controls.svelte`
Composes two `LatencySmoothing` groups (Pointer, Brush), plus individual sliders for Pen Speed, Brush Size, Report Rate, and a Path dropdown.

### `src/App.svelte`
Root component. Declares all `$state()` runes. Composes `SidePanel`, `Canvas`, `Controls` with `bind:` directives.

## Data Flow

```
penSpeed → time increment → autoPosition(time, pathType) → posA
                                                              ↓
                                                        posHistory[]
                                                              ↓
                                    reportRate → skip non-report frames
                                                              ↓
                           pointerLatency → getDelayedPos() → EMA(pointerSmoothing) → posB
                                                                                        ↓
                                                                                  posBHistory[]
                                                                                        ↓
                                            brushLatency → getBDelayedPos() → EMA(brushSmoothing) → posC
                                                                                                      ↓
                                                                                                brushTrail[]
                                                                                                      ↓
                                                                                          drawBrushStroke(brushSize)
```

## Build & Deploy

- **Dev**: `bun run dev` (or `npm run dev`) — Vite dev server with HMR
- **Build**: `bun run build` — produces optimized static files in `dist/`
- **Deploy**: Push to `master` → GitHub Actions builds and deploys to GitHub Pages at `/WebDrawTabLagSim/`

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
    ├── Slider.svelte
    └── LatencySmoothing.svelte
        └── Slider.svelte
```
