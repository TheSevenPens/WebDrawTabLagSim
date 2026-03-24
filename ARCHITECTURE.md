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
    └── drawing.js              — All canvas drawing primitives + brush stroke rendering
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
│  [Pointer Lat+Smooth+Rate] [Brush Lat+Smooth]   │
│  [Speed] [Size] [Spacing] [Trail] [Path]         │
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

In addition to latency and smoothing, point B is governed by a **report rate** that simulates the tablet's hardware update frequency. The animation runs at ~60fps, but B only updates its position on "report frames" determined by the report rate. Between reports, B holds its last position. This creates visible stepping/jumping at low report rates (e.g., 2-5 Hz), faithfully modeling how low-frequency tablets behave. The Report Rate slider is grouped with the Pointer controls since it is a pointer-related parameter.

### Pipeline

```
A (pen tip) ──[report rate gate → pointer latency + pointer smoothing]──→ B (OS pointer)
B (OS pointer) ──[brush latency + brush smoothing]──→ C (brush position)
                                                        ↓
                                              brushSpacing distance gate
                                                        ↓
                                             brushTrail[] (ring buffer)
                                                        ↓
                                              brushTrailLength cap
                                                        ↓
                                      smoothStroke? → Catmull-Rom + subdivision
                                                     or straight lineTo
                                                        ↓
                                          drawBrushStroke(brushSize, smoothStroke)
```

## Brush Stroke Rendering

The brush stroke is one of the most visually complex parts of the app. It models how a real drawing application's brush engine renders marks on screen.

### Brush Spacing (Distance Threshold)

Real brush engines don't render a stroke segment every single frame. Instead, they wait until the cursor has moved a minimum distance (the "spacing" or "step" distance) before placing the next dab or segment. This is controlled by the **Brush Spacing** slider:

- **Spacing = 0**: Continuous mode — a new trail point is added every frame (the default).
- **Spacing > 0**: The simulation checks the Euclidean distance from the last recorded trail point to C's current position. If `dx² + dy² < spacing²`, the frame is skipped. Only when C has traveled far enough is a new point appended to `brushTrail[]`.

At high spacing values (20-50px), the trail becomes visibly segmented — the stroke is composed of widely-spaced sample points connected by straight lines, with abrupt width changes at each joint. This is faithful to how real brush engines look at high spacing.

### Brush Trail Length

The **Brush Trail** slider (5–300, default 180) controls how many points the ring buffer retains. When brush spacing is high, fewer points are added per second, so the trail naturally covers more distance before wrapping. Reducing the trail length prevents the stroke from looping back into itself. The buffer uses a simple shift-based ring: `while (brushTrail.length > maxTrailLength) brushTrail.shift()`.

### Smooth Stroke (Catmull-Rom + Subdivision)

When the **Smooth stroke** checkbox is enabled, the rendering switches from straight line segments to a two-layer smoothing system that dramatically improves visual quality, especially at high brush spacing:

#### Layer 1: Catmull-Rom Spline Interpolation

Instead of connecting trail points with straight lines (`lineTo`), the renderer computes **Catmull-Rom splines** that pass through every control point with C1 continuity (matching tangent directions at each point).

For each segment between trail points `p1` and `p2`, the algorithm looks at four neighboring points:

```
p0 ── p1 ════════ p2 ── p3
       ↑ segment  ↑
```

It converts the Catmull-Rom segment to a cubic Bezier with control points:

```
cp1 = p1 + (p2 - p0) × tension / 6
cp2 = p2 - (p3 - p1) × tension / 6
```

where `tension = 0.5` (standard Catmull-Rom). At the ends of the trail, boundary points are clamped (`p0 = trail[0]` for the first segment, `p3 = trail[last]` for the last).

This eliminates the sharp corners that appear when widely-spaced points are connected by straight lines. The curve naturally flows through each sample point.

#### Layer 2: Per-Segment Subdivision (16×)

Catmull-Rom alone still has a visual problem: each segment is drawn as a **single canvas stroke with one width**, so the line width jumps discontinuously at each control point. If trail point i has width 12px and point i+1 has width 18px, you see a sudden step.

To fix this, each Catmull-Rom segment is **subdivided into 16 sub-segments**. For each subdivision step `s` from 0 to 1:

1. **Position** is evaluated on the cubic Bezier using De Casteljau's algorithm:
   ```
   x(s) = (1-s)³·p1 + 3(1-s)²s·cp1 + 3(1-s)s²·cp2 + s³·p2
   ```

2. **Width** is smoothly interpolated between the segment start and end:
   ```
   t = t0 + (t1 - t0) × s        // normalized position along full trail
   width = (1 + t² × 35) × brushSize
   ```

3. **Opacity** is similarly interpolated:
   ```
   alpha = 0.08 + t × 0.55
   ```

Each sub-segment is drawn as a short `lineTo` with `lineCap = 'round'`, so the 16 tiny overlapping strokes create a seamlessly tapered curve with no visible width discontinuities.

#### Highlight Pass

Both rendering modes (straight and smooth) include a second "highlight" pass that draws a lighter, slightly offset stroke over the top half of the trail. This creates a subtle specular highlight effect that gives the brush mark a 3D/wet-paint appearance. In smooth mode, the highlight is also subdivided.

#### Visual Comparison

```
Spacing=0, Smooth=off:   ████████████████  (continuous, smooth by density)
Spacing=30, Smooth=off:  ■───■───■───■───  (segmented, angular, width jumps)
Spacing=30, Smooth=on:   ●═══●═══●═══●═══  (curved, tapered, seamless)
```

### Brush Size

The **Brush Size** slider (0.1–3, default 1) is a global multiplier applied to all width calculations in `drawBrushStroke`. At 1.0, the stroke peaks at 36px wide. At 0.5, it peaks at 18px. At 3.0, it peaks at 108px.

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
brushSpacing                        — Min pixel distance between trail points (0 = continuous)
brushTrailLength                    — Max trail buffer size (5–300, default 180)
smoothStroke                        — Enable Catmull-Rom + subdivision rendering
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
Models the runtime lag pipeline. **Framework-agnostic** — accepts params explicitly, no Svelte imports. Maintains module-level mutable state (EMA accumulators, history buffers, report rate frame counter). Key exports: `pushHistory`, `pushBrushTrail(pos, brushSpacing, maxTrailLength)`, `computeCurrentPositions(W, H, params)`, `preWarm(W, H, params)`.

### `src/lib/animation.js`
Path functions (`lissajousPosition`, `circlePosition`, `starPosition`) and the unified `autoPosition(t, W, H, pathType)` dispatcher. Track pre-computation: `computeTrackA(W, H, penSpeed, pathType)`, `computeSmoothedTrack(inputTrack, latency, smoothing)`.

### `src/lib/drawing.js`
All canvas drawing primitives: pen, pointer (mouse icon), crosshair (white with black outline), dashed circles, labels, tracks, and the brush stroke renderer with its Catmull-Rom + subdivision pipeline. Key internal functions:

- `catmullRomToBezier(p0, p1, p2, p3)` — Converts 4 Catmull-Rom points to cubic Bezier control points
- `evalBezier(p0x, p0y, cp1x, cp1y, cp2x, cp2y, p1x, p1y, s)` — De Casteljau evaluation at parameter s
- `drawBrushStroke(ctx, trail, brushSize, smoothStroke)` — Main stroke renderer with branching for smooth/straight modes

### `src/components/Canvas.svelte`
The most complex component. Uses `onMount` for canvas setup, HiDPI scaling, double buffering, pre-warm, and `requestAnimationFrame` loop. Uses `$effect` to reactively recompute tracks when lag/speed/path props change.

### `src/components/SidePanel.svelte`
Legend text + checkbox/dropdown controls (including smooth stroke toggle). All toggle props use `$bindable()`.

### `src/components/Slider.svelte`
Reusable slider: label + range input (with configurable step) + value display to the right. Bindable `value` prop.

### `src/components/LatencySmoothing.svelte`
Composite component: groups a Latency slider and a Smoothing slider under a shared label. Used for both the Pointer and Brush control groups.

### `src/components/Controls.svelte`
Composes two `LatencySmoothing` groups (Pointer, Brush). The Pointer group includes Latency, Smoothing, and Report Rate (Hz) stacked together since report rate is a pointer-related parameter. A third column contains individual sliders for Pen Speed, Brush Size, Brush Spacing, Brush Trail, and a Path dropdown.

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
                                                                              brushSpacing threshold gate
                                                                                                      ↓
                                                                          brushTrail[] (capped by brushTrailLength)
                                                                                                      ↓
                                                                    smoothStroke? → Catmull-Rom + 16× subdivision
                                                                                     or straight lineTo segments
                                                                                                      ↓
                                                                                  drawBrushStroke(brushSize, smoothStroke)
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
