# Architecture

Single-page HTML/CSS/JS app that animates drawing tablet lag using HTML5 Canvas. No build tools or frameworks. JavaScript is organized as ES modules.

## File Structure

```
index.html          — HTML structure and CSS styles
js/
├── main.js         — entry point: canvas setup, render loop, track management
├── constants.js    — colors, font, sizes, offsets, buffer limits
├── state.js        — shared mutable UI state object
├── simulation.js   — lag pipeline: delay + EMA smoothing for B and C
├── drawing.js      — all canvas drawing primitives
├── animation.js    — Lissajous path, deterministic track pre-computation
└── controls.js     — slider/checkbox/select DOM binding
ARCHITECTURE.md     — this file
FUTURES.md          — ideas for improvements
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

- **Side Panel** (left): Contains the legend and all checkbox/dropdown controls stacked vertically.
  - **Legend**: Defines positions a, b, c and lag types (latency + smoothing).
  - **Toggles**: Visibility for labels (a/b/c), OS pointer (mouse or crosshair), tracks (a/b/c), and dotted circles (a/b/c).
- **Canvas** (center-right): Double-buffered `<canvas>` — all animation rendering happens here.
- **Sliders** (bottom): Pointer Latency, Pointer Smoothing, Brush Latency, Brush Smoothing, Pen Speed.

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

Tracks are recomputed whenever latency, smoothing, or pen speed sliders change. Track B is only displayed when pointer smoothing > 0 (otherwise it's identical to Track A). Same logic for Track C and brush smoothing.

## Module Responsibilities

### `constants.js`
Exports all shared configuration:
- `COLORS` — centralized color palette: separate named colors for circleA (blue), circleB (red), circleC (green), background (slate gray), pen body/tip, brush stroke.
- `FONT` — Google Sans Flex font string for canvas text.
- `LABEL_OFFSETS` / `CIRCLE_RADII` — per-position label placement and circle sizes.
- `HISTORY_SIZE` / `BRUSH_TRAIL_MAX` — rolling buffer capacities.
- `TIME_STEP_SCALE` — multiplier converting pen speed slider value to time delta per frame.

### `state.js`
Exports a single `state` object holding all mutable UI state:
- **Lag parameters**: `pointerLatency`, `pointerSmoothing`, `brushLatency`, `brushSmoothing`, `penSpeed`.
- **Visibility toggles**: `showA/B/C` (labels), `showCircleA/B/C` (dotted circles), `showTrackA/B/C` (path tracks), `showPointer` (OS pointer).
- **Pointer style**: `'mouse'` or `'crosshair'`.

Mutated directly by controls; read by the render loop.

### `simulation.js`
Models the runtime lag pipeline. Maintains:
- `posHistory[]` — rolling buffer of A positions.
- `posBHistory[]` — rolling buffer of B positions (so C can delay off B's output).
- `brushTrail[]` — C positions for stroke rendering.
- EMA accumulators for B and C.

Key exports:
- `pushHistory(pos)` / `pushBrushTrail(pos)` — feed the buffers.
- `computeCurrentPositions(W, H)` — compute B and C for the current frame using delay + EMA.
- `preWarm(W, H)` — run HISTORY_SIZE frames of simulation so the visualization starts populated.

### `animation.js`
Deterministic path and track computation:
- `autoPosition(t, W, H)` — returns `{x, y}` on a Lissajous curve (frequencies 2:3).
- `computeTrackA(W, H, penSpeed)` — pre-compute one period of A positions at the runtime step rate.
- `computeSmoothedTrack(inputTrack, latency, smoothing)` — run an input track through delay + EMA for several warm-up periods, return the steady-state output track.

### `drawing.js`
All canvas drawing primitives. Each function takes `ctx` (offscreen canvas context) as its first argument:

| Function | Draws |
|---|---|
| `drawPen(ctx, x, y)` | Blue stylus with blue tip and drop shadow at position A |
| `drawPointer(ctx, x, y)` | White mouse cursor with black border at position B |
| `drawCrosshair(ctx, x, y)` | White crosshair with black border at position B |
| `drawDashedCircle(ctx, x, y, r, color)` | Colored dashed circle around any position |
| `drawLabel(ctx, text, x, y, fontSize)` | Bold italic letter (a/b/c) near a position |
| `drawBrushStroke(ctx, trail)` | Tapered stroke with highlight trailing position C |
| `drawTrack(ctx, points, color)` | Thin closed-loop path for a deterministic track |
| `drawPosition(ctx, pos, key, ...)` | Composite: dashed circle + label for a position |

### `controls.js`
Exports `initControls()` which binds all HTML inputs to the `state` object:
- `bindSlider(id, stateKey)` — connects a range input to a state property and its display span.
- `bindCheckbox(id, stateKey)` — connects a checkbox to a boolean state property.
- Pointer style dropdown bound via `change` event.

### `main.js`
Entry point loaded by `index.html` as `<script type="module">`. Responsibilities:
1. **Canvas setup**: Creates visible canvas + offscreen canvas for double buffering. Handles resize.
2. **Track management**: Pre-computes deterministic tracks for A, B, C. Watches slider values and recomputes when they change.
3. **Render loop** (`render()`): Runs via `requestAnimationFrame`. Each frame:
   - Advance time by `penSpeed * TIME_STEP_SCALE`.
   - Compute positions A (deterministic), B (delayed + smoothed A), C (delayed + smoothed B).
   - Update history and brush trail buffers.
   - Clear offscreen canvas.
   - Draw layers back-to-front: tracks → brush stroke → position C → OS pointer → position B → pen → position A.
   - Blit offscreen to visible canvas.
4. **Pre-warm**: Simulates HISTORY_SIZE frames before the first render so trails are populated on load.

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

## Module Dependency Graph

```
main.js
├── constants.js
├── state.js
├── simulation.js ─── constants.js, animation.js, state.js
├── drawing.js ────── constants.js
├── animation.js ──── constants.js
└── controls.js ───── state.js
```
