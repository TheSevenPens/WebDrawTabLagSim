# Architecture

Single-page HTML/CSS/JS app that animates drawing tablet lag using HTML5 Canvas. No build tools or frameworks. JavaScript is organized as ES modules.

## File Structure

```
index.html          — HTML structure and CSS styles
js/
├── main.js         — entry point: canvas setup, render loop, pre-warm
├── constants.js    — colors, font, sizes, offsets, buffer limits
├── state.js        — shared mutable UI state object
├── history.js      — position history & brush trail buffers
├── drawing.js      — all canvas drawing primitives
├── animation.js    — Lissajous auto-animation path
└── controls.js     — slider/checkbox/select DOM binding
ARCHITECTURE.md     — this file
FUTURES.md          — ideas for improvements
```

## Layout

```
┌─────────────────────────────────────────────────┐
│                    Title                         │
├──────────┬─────────────────────┬────────────────┤
│  Legend  │       Canvas        │   Checkboxes   │
│  (HTML)  │   (animation area)  │   (HTML)       │
├──────────┴─────────────────────┴────────────────┤
│              Sliders (HTML)                      │
└─────────────────────────────────────────────────┘
```

- **Legend** (left): HTML `div.legend` — defines positions a, b, c and lag types.
- **Canvas** (center): Double-buffered `<canvas>` — all animation rendering happens here.
- **Checkboxes** (right): HTML `div.checkboxes` — toggle visibility of connector lines, labels, circles, OS pointer; dropdown for pointer style (mouse/crosshair).
- **Sliders** (bottom): HTML `div.controls` — Pointer Lag, Brush Lag, Pen Speed.

## Module Responsibilities

### `constants.js`
Exports all shared configuration:
- `COLORS` — centralized color palette for all drawn elements.
- `FONT` — shared font string for canvas text rendering.
- `LABEL_OFFSETS` / `CIRCLE_RADII` — per-position (a, b, c) label placement and circle sizes.
- `HISTORY_SIZE` / `BRUSH_TRAIL_MAX` — rolling buffer capacities.
- `TIME_STEP_SCALE` — multiplier converting pen speed slider value to time delta.

### `state.js`
Exports a single `state` object holding all mutable UI state: slider values (`pointerLag`, `brushLag`, `penSpeed`), visibility toggles (`showLineAB`, `showA`, `showCircleA`, etc.), and `pointerStyle` ('mouse' or 'crosshair'). Mutated directly by controls; read by the render loop.

### `history.js`
Manages two rolling buffers:
- `posHistory[]` — pen positions (size: `HISTORY_SIZE`). Fed by `pushHistory()`.
- `brushTrail[]` — position-c coordinates for stroke rendering (size: `BRUSH_TRAIL_MAX`). Fed by `pushBrushTrail()`.
- `getLaggedPos(lagFrames, W, H)` — reads from `posHistory` N frames behind the current frame.

### `drawing.js`
All canvas drawing primitives. Each function takes `ctx` as its first argument (the offscreen canvas context):

| Function | Draws | Positioned at |
|---|---|---|
| `drawPen(ctx, x, y)` | Blue stylus with red tip and drop shadow | Position a (tip at x,y) |
| `drawPointer(ctx, x, y)` | White mouse cursor with black border | Position b (tip at x,y) |
| `drawCrosshair(ctx, x, y)` | White crosshair with black border | Position b (center at x,y) |
| `drawDashedCircle(ctx, x, y, r, color)` | Red dashed circle | Around any position |
| `drawDashedLine(ctx, x1, y1, x2, y2)` | Dashed connector line | Between positions |
| `drawLabel(ctx, text, x, y, fontSize)` | Bold italic letter (a/b/c) | Near a position |
| `drawBrushStroke(ctx, trail)` | Tapered stroke with highlight | Trailing position c |
| `drawPosition(ctx, pos, key, ...)` | Composite: circle + label for a position | Any position |

### `animation.js`
Exports `autoPosition(t, canvasWidth, canvasHeight)` — returns `{x, y}` on a Lissajous curve parameterized by time `t`. The curve fills most of the canvas area.

### `controls.js`
Exports `initControls()` which binds all HTML inputs to the `state` object:
- `bindSlider(id, stateKey)` — connects a range input to a state property and its display span.
- `bindCheckbox(id, stateKey)` — connects a checkbox to a boolean state property.
- Pointer style dropdown bound via `change` event.

### `main.js`
Entry point loaded by `index.html` as `<script type="module">`. Responsibilities:
1. **Canvas setup**: Creates visible canvas + offscreen canvas for double buffering. Handles resize.
2. **Render loop** (`render()`): Runs via `requestAnimationFrame`. Each frame:
   - Advance time by `penSpeed * TIME_STEP_SCALE`.
   - Compute positions: a (current), b (lagged by pointer lag), c (lagged by pointer + brush lag).
   - Update history buffers.
   - Clear offscreen canvas with yellow background.
   - Draw layers back-to-front: brush stroke → connector lines → position c → pointer → position b → pen → position a.
   - Blit offscreen to visible canvas.
3. **Pre-warm** (`preWarm()`): Simulates several seconds of animation before the first frame so the visualization starts with visible spread between positions.

## Data Flow

```
penSpeed → time increment → autoPosition(time) → posA
                                                    ↓
                                              posHistory[]
                                                    ↓
                              pointerLag → getLaggedPos() → posB
                              brushLag   → getLaggedPos() → posC → brushTrail[]
                                                                      ↓
                                                              drawBrushStroke()
```

## Module Dependency Graph

```
main.js
├── constants.js
├── state.js
├── history.js ──── constants.js
├── drawing.js ──── constants.js
├── animation.js
└── controls.js ─── state.js
```
