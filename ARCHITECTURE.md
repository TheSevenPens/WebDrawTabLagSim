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
│   ├── TopPanel.svelte         — Title bar + playback controls (Play/Pause, Stop/Resume Pen, Restart, Reset All)
│   ├── SidePanel.svelte        — Left panel with all controls in collapsible sections
│   ├── CollapsibleSection.svelte — Reusable collapsible ▼/▶ section wrapper
│   ├── Slider.svelte           — Reusable slider control (label left, value right, track underneath)
│   └── Presets.svelte          — Preset management UI (save, load, rename, delete, export, import)
└── lib/
    ├── constants.js            — Colors, font, sizes, offsets, buffer limits
    ├── simulation.js           — Lag pipeline: delay + EMA + report rate for B and C
    ├── animation.js            — Path functions (Lissajous, Circle, Star), track pre-computation
    ├── drawing.js              — All canvas drawing primitives + brush stroke rendering
    ├── screen.js               — Simulated screen: pixelation, refresh rate, response time, grid
    └── presets.js              — Pure localStorage CRUD for named preset configurations
.github/workflows/deploy.yml   — GitHub Actions: build and deploy to Pages
ARCHITECTURE.md                 — This file
FUTURES.md                      — Ideas for improvements
```

## Layout

```
┌─────────────────────────────────────────────────┐
│  Title  [Play/Pause] [Stop/Resume] [Restart] [Reset All]  │  ← TopPanel
├──────────────┬──────────────────────────────────┤
│  Side Panel  │            Canvas                 │
│  ▶ PEN       │       (animation area)            │
│  ▶ TABLET    │                                   │
│  ▶ OS POINTER│    [📷]                    [⛶]    │
│  ▶ BRUSH     │                                   │
│  ▶ VIEW      │                                   │
│  ▶ DISPLAY   │                                   │
│  ▶ PRESETS   │                                   │
└──────────────┴──────────────────────────────────┘
```

- **Top Panel** (`TopPanel.svelte`): Title and playback controls (Play/Pause, Stop Pen/Resume Pen, Restart, Reset All).
- **Side Panel** (left, `SidePanel.svelte`, 280–320px): All controls organized in collapsible sections (all collapsed by default). Sections: PEN, TABLET, OS POINTER, BRUSH, VIEW, DISPLAY, PRESETS.
- **Canvas** (center-right, `Canvas.svelte`): Double-buffered HiDPI `<canvas>` for animation. Constant height of 600px; width computed from the selected aspect ratio. Screenshot button top-left, fullscreen button top-right (⛶ icon).

## Lag Model

Each stage in the pen-to-display pipeline has two parameters:

| Parameter | Effect |
|---|---|
| **Latency** | Pure time delay in frames — B sees A's position from N frames ago |
| **Smoothing** | EMA (exponential moving average) filter strength — rounds corners, shrinks the path |

The EMA formula: `output = α × input + (1 − α) × prev_output` where `α = 1 / (1 + smoothing)`. When smoothing=0, α=1, so B follows A's exact path (just delayed). When smoothing>0, B traces a tighter, corner-cutting path.

### Report Rate

In addition to latency and smoothing, point B is governed by a **report rate** that simulates the tablet's hardware update frequency. The animation runs at ~60fps, but B only updates its position on "report frames" determined by the report rate. Between reports, B holds its last position. This creates visible stepping/jumping at low report rates (e.g., 2-5 Hz), faithfully modeling how low-frequency tablets behave. The Report Rate slider is grouped in the TABLET section since it is a tablet hardware parameter.

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
                                                        ↓
                                              screenMode? → render to low-res screen canvas
                                                           → response time blending (ghosting)
                                                           → composite with pixel grid
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

The **Brush Size** slider (1–30, default 4) uses human-friendly numbers. Internally the drawing code converts to a scale factor via `scale = brushSize / 10`.

## Path Types

The pen tip (A) can follow different deterministic paths, selectable via dropdown:

| Path | Description |
|---|---|
| **Lissajous** | Parametric curve with frequency ratio 2:3, creates a pretzel shape |
| **Circle** | Simple elliptical orbit |
| **Star** | Pentagram — pen moves directly between the 5 star points in skip-one order |

All paths share the same period (2π) and are centered on the canvas with configurable amplitude. Circle path speed is normalized (CIRCLE_SPEED = 2.5) to match Lissajous/Star perceived speed. Changing path type auto-restarts the animation.

## Deterministic Tracks

Because A follows a periodic path, the steady-state paths of B and C are also periodic and fully deterministic for any given parameter set. The app pre-computes these tracks:

1. **Track A**: Sample one full period at the runtime step rate.
2. **Track B**: Run A's track through the delay + EMA pipeline for several warm-up periods, keep the last period.
3. **Track C**: Run B's track through C's delay + EMA pipeline the same way.

Tracks are recomputed reactively via `$effect` whenever latency, smoothing, pen speed, or path type change. Track B is normally only displayed when pointer smoothing > 0 (otherwise identical to Track A), and Track C when brush smoothing > 0. However, when a parent point is hidden (e.g., pen hidden), child tracks are shown regardless of smoothing so there is always a visible track for each shown point.

## Screen Simulation

When **Screen mode** is enabled, the OS pointer and brush stroke are rendered onto a simulated low-resolution display instead of being drawn directly at full resolution. This models what a real physical screen does to the signal.

### Architecture

A separate small offscreen canvas (`screen.canvas`) represents the simulated display. Its resolution is controlled by the **Resolution** slider (80–320 pixels wide), with height derived from the canvas aspect ratio. The existing drawing functions (`drawBrushStroke`, `drawPointer`, `drawCrosshair`) are reused unmodified — a `ctx.scale()` transform maps logical coordinates to screen pixel coordinates.

### Two-Layer Rendering

In screen mode, the render loop splits into two layers:

1. **Full-resolution layer** (main canvas): Background, tracks, pen, labels, circles — the "ground truth" overlays.
2. **Screen layer** (small canvas → scaled up): Brush stroke and OS pointer — what the user actually sees on their monitor.

The screen layer is composited onto the main canvas with `imageSmoothingEnabled = false` for crisp nearest-neighbor upscaling, producing visible blocky pixels.

### Screen Refresh Rate

The screen only updates at the configured refresh rate (10–144 Hz). Between refreshes, the screen holds its last frame (LCD "sample-and-hold" behavior). A time-based accumulator gates when `shouldRefresh()` returns true, following the same pattern as the tablet report rate.

### Pixel Response Time (Ghosting)

Models LCD pixel transition speed. A `Float32Array` color buffer stores the persistent pixel state. On each refresh, new pixel values are blended into the buffer using:

```
alpha = 1 - exp(-dt / responseTime)
pixel = pixel + alpha × (newPixel - pixel)
```

Fast response (1ms) → near-instant transition. Slow response (50ms) → visible ghosting/persistence as pixels gradually shift from their old color to the new one.

### Pixel Grid

When enabled, thin semi-transparent lines are drawn at every pixel boundary after compositing, making the individual simulated pixels clearly delineated.

### Planned: CRT / Display Shader Effects

A future enhancement direction is to add CRT-style visual effects (scanlines, RGB sub-pixel rendering, bloom) to the simulated screen. The initial approach would use Canvas 2D drawing inside `renderScreenToMain` in `screen.js` — scanlines as semi-transparent horizontal lines, sub-pixels as tinted vertical sub-rects per pixel. See FUTURES.md for full details and implementation options.

## HiDPI Rendering

The canvas backing store is sized at `logicalWidth × dpr` by `logicalHeight × dpr` (where `dpr = devicePixelRatio`), while CSS dimensions remain at logical size. Each frame applies `ctx.setTransform(dpr, 0, 0, dpr, 0, 0)` so all drawing code uses logical coordinates. The transform is reset before blitting the offscreen buffer.

## State Management

All mutable state lives in `App.svelte` as Svelte 5 `$state()` runes:

```
pointerLatency, pointerSmoothing    — Pointer lag parameters
brushLatency, brushSmoothing        — Brush lag parameters
penSpeed                            — Animation speed (0.5–10, step 0.5)
pathType                            — Path shape: 'lissajous' | 'circle' | 'star'
brushSize                           — Brush stroke size (1–30, default 4; scale = brushSize / 10)
brushSpacing                        — Min pixel distance between trail points (0 = continuous)
brushTrailLength                    — Max trail buffer size (5–300, default 180)
smoothStroke                        — Enable Catmull-Rom + subdivision rendering
reportRate                          — Tablet report rate in Hz (1–60)
showPen                              — Pen visibility (header checkbox in PEN section; hides pen, label, track, circle for A)
showPointer                          — OS pointer visibility (header checkbox in OS POINTER section; hides pointer, label, track, circle for B)
showBrushStroke                      — Brush stroke visibility (header checkbox in BRUSH section; hides stroke, label, track, circle for C)
pointerStyle                        — OS pointer style (mouse/crosshair)
pointerSize                         — OS pointer scale factor (1, 2, 4, or 8; default 1)
showLabels                           — Toggle all letter labels (a, b, c)
showTracks                           — Toggle all track lines
showCircles                          — Toggle all dotted circles
aspectRatio                         — Canvas aspect ratio ('16:9', '16:10', '4:3', '1:1'; default '16:9')
screenMode                          — Enable simulated screen layer
screenResolution                    — Screen width in simulated pixels (80–320)
screenRefreshRate                   — Screen refresh rate in Hz (10–144)
screenResponseTime                  — Pixel response time in ms (1–50)
showPixelGrid                       — Show grid lines between simulated pixels
frozen                              — Play/Pause state (true freeze, entire visualization stops)
paused                              — Stop Pen/Resume Pen state (pen stops, b and c catch up)
```

State flows down via props. `SidePanel` uses `bind:` for two-way binding. `Canvas` receives read-only props.

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

### `src/lib/screen.js`
Simulated screen buffer management. Creates and manages a low-resolution offscreen canvas with a Float32Array color buffer for response time blending. Key exports: `createScreen(w, h)`, `resizeScreen(screen, w, h)`, `shouldRefresh(screen, dtMs, hz)`, `commitFrame(screen, responseMs, dtMs)`, `renderScreenToMain(ctx, screen, W, H, showGrid)`, `drawPixelGrid(ctx, ...)`.

### `src/components/Canvas.svelte`
The most complex component. Uses `onMount` for canvas setup, HiDPI scaling, double buffering, pre-warm, and `requestAnimationFrame` loop. Uses `$effect` to reactively recompute tracks when lag/speed/path props change. Canvas has a constant height of 600px with width derived from the aspect ratio; changing aspect ratio triggers a simulation reinit (reset + pre-warm). When `frozen` is true, the entire render loop is skipped (true pause). When `paused` is true, pen movement stops but the simulation continues so b and c catch up. When screen mode is enabled, the render loop branches: brush stroke and pointer are drawn to the screen canvas, blended through the response time buffer, then composited onto the main canvas. Full-resolution overlays (pen, labels, circles, tracks) are drawn on top. Fullscreen/resize triggers a reset and pre-warm to prevent erratic brush trail artifacts.

### `src/lib/presets.js`
Pure localStorage CRUD for named preset configurations. Storage key: `lag-viz-presets`. Format: `[{ name, data }]` where `data` contains all settings values (including `pointerSize` and `aspectRatio`). Key exports: `loadPresetList()`, `savePreset(name, data)`, `deletePreset(name)`, `renamePreset(oldName, newName)`, `exportPresets()`, `importPresets(jsonString)`.

### `src/components/Presets.svelte`
Preset management UI component. Provides a save input field, a scrollable preset list (click to load, rename via pencil icon, delete via x button), and export/import buttons. Uses a `children` snippet prop to render inside SidePanel. Calls into `presets.js` for all storage operations.

### `src/components/TopPanel.svelte`
Title bar and playback control buttons: Play/Pause (frozen), Stop Pen/Resume Pen (paused), Restart, and Reset All. Buttons use fixed min-width to prevent layout shift when labels change.

### `src/components/SidePanel.svelte`
Left side panel containing all controls organized in collapsible sections (via CollapsibleSection). PEN, OS POINTER, and BRUSH sections have header checkboxes that control full visibility of their respective points (hiding the point also hides its label, track, and circle). Sections: PEN (pen speed, path type), TABLET (latency, smoothing, report rate), OS POINTER (pointer style, pointer size), BRUSH (brush latency/smoothing, size/spacing/trail, smooth stroke toggle), VIEW (unified labels/tracks/circles toggles for all points), DISPLAY (aspect ratio, screen mode + sub-options), PRESETS. All sections start collapsed on load. Custom dark-themed styling: dark checkboxes (#4a4a4a unchecked, #7089a8 checked), dark slider track (#4a4a4a) with slate gray thumb (#7089a8), dark dropdowns (#4a4a4a background, #ccc text), thin custom scrollbar (6px, #555) with 12px right padding for clearance.

### `src/components/CollapsibleSection.svelte`
Reusable collapsible section wrapper with a clickable header showing a ▼/▶ indicator and a title. Content is shown/hidden based on collapsed state. Supports an optional `headerExtra` snippet slot for placing controls (e.g., checkboxes) in the header row alongside the title.

### `src/components/Slider.svelte`
Reusable slider: label and value on the same row (label left-aligned, value right-aligned), range track underneath. Custom dark-themed styling. Bindable `value` prop.

### `src/App.svelte`
Root component. Declares all `$state()` runes (including `pointerSize` and `aspectRatio`). Composes `TopPanel`, `SidePanel`, `Canvas`, and `Presets` with `bind:` directives. Provides `getCurrentSettings()` to snapshot all state values into a plain object, and `loadPreset(data)` to restore state from a saved preset object. Both `pointerSize` and `aspectRatio` are included in presets/save/load/reset. `Presets` is mounted as a child of `SidePanel` via the children snippet prop.

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
├── TopPanel.svelte
├── Canvas.svelte
│   ├── lib/constants.js
│   ├── lib/simulation.js ─── lib/constants.js, lib/animation.js
│   ├── lib/drawing.js ────── lib/constants.js
│   ├── lib/animation.js ──── lib/constants.js
│   └── lib/screen.js ─────── lib/constants.js
└── SidePanel.svelte
    ├── CollapsibleSection.svelte
    ├── Slider.svelte
    └── Presets.svelte (via children snippet)
        └── lib/presets.js
```
