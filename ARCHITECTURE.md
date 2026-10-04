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
    ├── constants.js            — Colors, font, sizes, offsets, buffer limits, tick rate
    ├── settings.js             — Every setting's default/range/options; validation (sanitizeSettings)
    ├── clock.js                — Host frame times → whole simulation ticks
    ├── rate-meter.js           — Rolling-window rate (events/s) and the frame-rate readout text
    ├── simulation.js           — createSimulation(): instance-owned lag pipeline (delay + EMA + report rate)
    ├── reference.js            — Reference tracks, computed by running an isolated simulation instance
    ├── animation.js            — Path functions (Lissajous, Circle, Star)
    ├── drawing.js              — All canvas drawing primitives + brush stroke rendering
    ├── screen.js               — Simulated screen: pixelation, refresh rate, response time, grid
    └── presets.js              — Versioned, validated preset storage (injectable storage adapter)
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
- **Canvas** (center-right, `Canvas.svelte`): Double-buffered HiDPI `<canvas>` for animation. At most 600px tall, with width from the selected aspect ratio; when the layout gives it less width (narrow windows, the sidebar) it scales down, keeping the aspect ratio. Screenshot button top-left, fullscreen button top-right (⛶ icon).

## Lag Model

Each stage in the pen-to-display pipeline has two parameters:

| Parameter | Effect |
|---|---|
| **Latency** | Pure time delay in ticks (1 tick = 1/60 s of simulated time) — B sees A's position from N ticks ago |
| **Smoothing** | EMA (exponential moving average) filter strength — rounds corners, shrinks the path |

The EMA formula: `output = α × input + (1 − α) × prev_output` where `α = 1 / (1 + smoothing)`. When smoothing=0, α=1, so B follows A's exact path (just delayed). When smoothing>0, B traces a tighter, corner-cutting path.

### Report Rate

In addition to latency and smoothing, point B is governed by a **report rate** that simulates the tablet's hardware update frequency. The simulation runs at a fixed 60 ticks per second (see Timing Model), and B only updates its position on "report ticks" determined by the report rate. Report timing uses a fractional accumulator, so any rate is exact over time (45 Hz reports on 3 of every 4 ticks). Between reports, B holds its last position. This creates visible stepping/jumping at low report rates (e.g., 2-5 Hz), faithfully modeling how low-frequency tablets behave. The Report Rate slider is grouped in the TABLET section since it is a tablet hardware parameter.

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

- **Spacing = 0**: Continuous mode — a new trail point is added every tick (the default).
- **Spacing > 0**: The simulation checks the Euclidean distance from the last recorded trail point to C's current position. If `dx² + dy² < spacing²`, the tick is skipped. Only when C has traveled far enough is a new point appended to `brushTrail[]`.

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

#### Layer 2: Per-Segment Subdivision (1, 2, 4, 8 or 16 pieces)

Catmull-Rom alone still has a visual problem: each segment is drawn as a **single canvas stroke with one width**, so the line width jumps discontinuously at each control point. If trail point i has width 12px and point i+1 has width 18px, you see a sudden step.

To fix this, each Catmull-Rom segment is **subdivided into sub-segments**: 1, 2, 4, 8 or 16, chosen per segment by `subdivisionsFor()`. Every piece is its own `stroke()` call, and a fixed 16 per segment drew thousands of strokes per frame (measured at about 17 ms for a 300-point trail at devicePixelRatio 2, over the whole 60 fps budget; about 0.7 ms adaptive). The rule is the fewest pieces that satisfy both:

- **Geometry.** The polyline stays within 0.25 px of the 16-piece curve (checked against that curve directly, so it needs no curvature estimate). This looks at the curve itself, not the distance between the endpoints: at low tablet report rates the trail holds repeated positions, and two identical endpoints can still have a curved Bezier when their neighbors pull it (up to ~7 px at 1 Hz). Straight runs need one piece however long they are.
- **Paint.** Width and opacity change along the trail and each piece is drawn with one value, so a change of more than 0.5 px of width or 0.03 of opacity per piece needs more pieces. Short trails change fastest per segment.

Powers of two keep the pieces nested in the 16, so the geometry guarantee holds whatever the paint demands. Tests compare against the 16-piece curve on real trails at report rates from 60 down to 1 Hz, on star corners, and with brush spacing. For each subdivision step `s` from 0 to 1:

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

Paths are centered on the canvas with configurable amplitude. Lissajous and Star repeat every 2π of path time. The Circle runs at a speed factor (`CIRCLE_SPEED` = 2.5) so it feels as fast as the other two, which means one revolution takes 2π / 2.5 of path time, so it repeats sooner than the others at the same pen speed. `periodTicks(penSpeed, pathType)` gives each path's period in ticks. Changing path type auto-restarts the animation.

## Timing Model

The simulation is decoupled from the display. It advances in fixed **ticks** of simulated time (60 per second, `TICKS_PER_SECOND`), and everything with a time unit is defined in that clock:

- **Latency** is in ticks (16.67 ms each).
- **Report rate** is in Hz of simulated time.
- **Pen speed** is a per-tick increment of path time.
- **Screen refresh rate and response time** advance by the simulated time that elapsed, not by host frames.

Each animation frame, `Canvas.svelte` passes the host frame time to `clock.advance()`, which returns how many whole ticks are due, and steps the simulation that many times. A 120 or 144 Hz display usually runs zero or one tick per frame, a 30 Hz display runs two, and all of them produce the same simulated trajectory. Details and limits:

- **Frame gaps are capped at 250 ms.** A backgrounded tab resumes instead of replaying the gap; the extra time is dropped.
- **Tick snapping.** A tick runs when the accumulator is within 1 ms of a full tick, so a 60 Hz display with timestamp noise gets exactly one tick per frame instead of an occasional 0 then 2. The long-run tick count is still exact.
- **Presentation limit.** The state only changes 60 times per second, so a faster display shows each state for more than one frame. It is not interpolated, and the host's real frame rate is a separate limit on what can be seen.
- **Pausing.** `simPaused` (Play/Pause) stops the clock and resets it on resume. `penStopped` (Stop Pen) holds only the pen still while the simulation keeps ticking, so B and C converge onto it. The two are independent and have different names on purpose: one pauses *time*, the other stops *the pen*.

`createSimulation()` returns an instance that owns all of its state (histories, filter state, report accumulator, brush trail, pen time). It knows nothing about the DOM, the clock or storage, so any number of instances run independently (the canvas has one; reference tracks use another).

## Reference Tracks

Because A follows a periodic path, the steady-state paths of B and C are also periodic and deterministic for any given parameter set. The app draws them as guide tracks by running an **isolated simulation instance**, the same engine and tick model as the live view (`reference.js`):

1. Warm up until the filters' transients decay. The length is derived from the settings (`warmupTicks()`): pointer smoothing advances once per tablet *report*, so its time constant is `(1 + smoothing) × 60 / reportRate` ticks (about 51 s at 1 Hz and smoothing 50), brush smoothing advances every tick, and latencies are added; ten time constants are run, with a floor of 1500 ticks (or one period) and a cap of 250,000. The worst case recomputes in about 15 ms.
2. Record A, B and C each tick for one full period of the path.

Because it is the same pipeline, report-rate holding, latency and smoothing all appear in the tracks exactly as they do live. (An earlier version applied the EMA on every sample instead of every report, which drew the wrong track at low report rates.) The tablet report phase relative to the path period is not controlled, so at low report rates the exact held points can differ slightly from what is live at a given moment; shape and extent match.

Tracks are recomputed reactively via `$effect` whenever latency, smoothing, report rate, pen speed, or path type change. Track B is normally only displayed when pointer smoothing > 0 (otherwise identical to Track A), and Track C when brush smoothing > 0. However, when a parent point is hidden (e.g., pen hidden), child tracks are shown regardless of smoothing so there is always a visible track for each shown point.

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

The screen only updates at the configured refresh rate (10–144 Hz). Between refreshes, the screen holds its last frame (LCD "sample-and-hold" behavior). The screen layer is advanced **once per simulation tick** (`advanceScreen()`, right after the tick, using that tick's state), not once per host frame. Response time therefore integrates the same sequence of states whatever the host frame rate is: a 30 fps host that runs two ticks per frame gives the same pixels as a 60 fps host. Compositing onto the main canvas still happens once per host frame. An accumulator of simulated time counts how many refreshes are due (`consumeRefreshes()`); there can be several when the screen's refresh rate exceeds 60 Hz. `planScreenUpdate()` decides whether the layer redraws: it does when refreshes are due, or when the layer is dirty (new, reset or resized, or edited while paused). A plain pause leaves the layer untouched, so ghosts are preserved.

### Pixel Response Time (Ghosting)

Models LCD pixel transition speed. A `Float32Array` color buffer stores the persistent pixel state. On each refresh, new pixel values are blended into the buffer using:

```
k = 1 - exp(-dt / responseTime)
pixel = pixel + k × (newPixel - pixel)
```

Fast response (1ms) → near-instant transition. Slow response (200ms) → visible ghosting/persistence as pixels gradually shift from their old color to the new one.

- **Premultiplied blending.** The buffer holds red, green and blue premultiplied by alpha, plus alpha, and is converted back to straight color for display. A pixel that fades out keeps its hue and loses only opacity. (Blending straight color toward transparent black made ghosts darken toward black as they faded.)
- **One reset policy.** New and resized screens both start fully transparent (`createColorBuffer()`), so the tracks underneath show through and a resize fades like a fresh screen. (Resize used to start opaque background.)

### Anti-aliasing (AA)

Canvas 2D has no switch for vector anti-aliasing (`imageSmoothingEnabled` only affects scaled images, so it did nothing here). A pixel's alpha mixes two things: how much of the pixel a shape covers (anti-aliasing), and how transparent the paint is (the brush tail is deliberately faint, 0.08 opacity at its end). Thresholding the alpha would delete the tail, so with AA off the layer is drawn **twice** (`aliasFrame()` in `screen.js`):

1. the normal pass, giving color and opacity;
2. a coverage pass through `opaqueContext()`, a wrapper that drops the alpha from every color, giving the geometric coverage alone.

A pixel is covered when its coverage is at least 128, and is then kept with the paint's own opacity (drawn alpha / coverage); otherwise it is not drawn. The result has hard, jagged edges at the screen's resolution and keeps the faint tail. With AA on, partial coverage stays as partially transparent pixels and the second pass is skipped. (It costs about one extra draw: a 320×180 layer is about 2.5 ms with AA on and 3.6 ms off.)

### What the markers mean in screen mode

The circles and labels (a, b, c) mark the **ideal** positions from the simulation. The blocky pointer and stroke are what the **simulated screen displays**, which can lag behind the markers (refresh rate and response time), and the stroke is only extended when the brush has moved at least the spacing distance, so its last painted point can trail behind c. A lag measurement should say which of the three it reports: the logical position, the emitted stroke endpoint, or the displayed pixels.

### Pixel Grid

When enabled, thin semi-transparent lines are drawn at every pixel boundary after compositing, making the individual simulated pixels clearly delineated.

### Planned: CRT / Display Shader Effects

A future enhancement direction is to add CRT-style visual effects (scanlines, RGB sub-pixel rendering, bloom) to the simulated screen. The initial approach would use Canvas 2D drawing inside `renderScreenToMain` in `screen.js` — scanlines as semi-transparent horizontal lines, sub-pixels as tinted vertical sub-rects per pixel. See FUTURES.md for full details and implementation options.

## HiDPI Rendering

The canvas backing store is sized at `logicalWidth × dpr` by `logicalHeight × dpr` (where `dpr = devicePixelRatio`), while CSS dimensions remain at logical size. Each frame applies `ctx.setTransform(dpr, 0, 0, dpr, 0, 0)` so all drawing code uses logical coordinates. The transform is reset before blitting the offscreen buffer.

## State Management

All mutable state lives in `App.svelte` as Svelte 5 `$state()` runes, in two groups.

**Settings** are one object, `settings`, with a key for every control. Each setting is defined once in `SETTINGS` (`src/lib/settings.js`): its default, its range and step (or its options), and nothing else needs to repeat them. Slider ranges, dropdown options, Reset All, and preset validation all read from that definition. To add a setting, add one entry there, add its control in `SidePanel.svelte`, and read `settings.<name>` where it takes effect (see the README).

**Playback state** is separate from settings and is not saved in presets:

```
simPaused   — Play/Pause: time stops, the whole visualization holds
penStopped  — Stop Pen/Resume Pen: only the pen stops; B and C catch up
```

State flows down via props. `SidePanel` takes `bind:settings` and edits it in place; `Canvas` receives the settings spread as read-only props, plus the two playback flags.

### Reset rules

What resets the simulation (histories, filters, trail, then a pre-warm) and what does not:

| Action | Resets the simulation | Playback state (`simPaused`, `penStopped`) | Settings |
|---|---|---|---|
| Restart | yes | kept (a paused restart shows a valid, still-paused frame) | kept |
| Reset All | yes | kept | back to defaults |
| Load a preset | yes | kept | replaced by the preset (omitted fields take defaults) |
| Change path type | yes (auto-restart) | kept | the change |
| Change aspect ratio | yes | kept | the change |
| Canvas resize, fullscreen, pop-out/in, pixel-ratio change | yes | kept | kept |
| Any other setting (lag, smoothing, report rate, brush, display, view) | no, applied live | kept | the change |
| Play/Pause, Stop Pen | no | toggled | kept |

Changing the lag, smoothing or report-rate settings recomputes the reference tracks but does not touch the running simulation, so you can drag a slider and watch the pipeline respond. Settings do not reset when changed, so a slider drag never discards the trail.

## Module Responsibilities

### `src/lib/constants.js`
Centralized config: `COLORS` (separate named colors for A/B/C), `FONT`, `LABEL_OFFSETS`, `CIRCLE_RADII`, `HISTORY_SIZE`, `BRUSH_TRAIL_MAX`, `TIME_STEP_SCALE`.

### `src/lib/simulation.js`
Models the runtime lag pipeline as an **instance**: `createSimulation()` returns an object owning its histories, EMA state, report accumulator, brush trail and pen time. **Framework- and DOM-agnostic** — params are passed explicitly. Instance API: `step(W, H, params, { penMoving })` (one tick), `warmUp(W, H, params)`, `reset()`, `pushBrushTrail(pos, spacing, max)`, plus read-only `brushTrail`, `current`, `time`, `reportCount`.

### `src/lib/clock.js`
`createClock()` converts host frame times into whole simulation ticks (`advance(dtMs)`, `reset()`), with a frame-gap cap and tick snapping. See Timing Model.

### `src/lib/rate-meter.js`
`createRateMeter({ windowMs })` measures a rate over about the last second: `record(timestamp, count)` once per animation frame, `rate()` returns events per second (or `null` until there are two samples), `reset()`. `Canvas.svelte` keeps two: host frames per second (count 1 per frame) and simulation ticks per second (the ticks run that frame, which is 0 when the simulation is paused or the display is faster than 60 Hz). A gap longer than the window (a backgrounded tab) or a clock that goes backwards starts the window over, so the reading does not dip to near zero. `formatRates(fps, ticksPerSecond)` builds the text, e.g. `144 fps · 60 ticks/s`.

The readout is the optional `showRates` setting (VIEW → Frame rate, off by default, included in presets). Meters record every frame, which is a few array operations, but the readout's text is only updated every 250 ms. It is a DOM overlay inside the canvas container, so it is not in PNG snapshots or the pop-out window, and it is ordinary text, deliberately neither `aria-hidden` nor a live region: a screen reader user can read the current values on demand, and nothing is announced each time the numbers update (hiding it would remove the only copy of the values from the accessibility tree). It is the quickest way to see whether a display really runs at 120 or 144 Hz and whether the simulation keeps up (see #41).

### `src/lib/reference.js`
`computeReferenceTracks(W, H, params)` runs an isolated simulation instance and returns one period of tracks A, B and C. See Reference Tracks.

### `src/lib/settings.js`
`SETTINGS` defines every setting once (default, range and step, or options). `sanitizeSettings(raw)` turns untrusted data into a complete valid settings object, snapping numbers to the slider's step grid.

### `src/lib/animation.js`
Path functions (`lissajousPosition`, `circlePosition`, `starPosition`) and the unified `autoPosition(t, W, H, pathType)` dispatcher. `periodTicks(penSpeed, pathType)` gives the number of ticks in one path period.

### `src/lib/drawing.js`
All canvas drawing primitives: pen, pointer (mouse icon), crosshair (white with black outline), dashed circles, labels, tracks, and the brush stroke renderer with its Catmull-Rom + subdivision pipeline. Key internal functions:

- `catmullRomToBezier(p0, p1, p2, p3)` — Converts 4 Catmull-Rom points to cubic Bezier control points
- `evalBezier(p0x, p0y, cp1x, cp1y, cp2x, cp2y, p1x, p1y, s)` — De Casteljau evaluation at parameter s
- `drawBrushStroke(ctx, trail, brushSize, smoothStroke)` — Main stroke renderer with branching for smooth/straight modes

### `src/lib/screen.js`
Simulated screen buffer management. Creates and manages a low-resolution offscreen canvas with a Float32Array color buffer for response time blending. Key exports: `createScreen(w, h)`, `resizeScreen(screen, w, h)`, `consumeRefreshes(screen, dtMs, hz)`, `planScreenUpdate(screen, opts)`, `advanceScreen(screen, opts, draw)`, `commitFrame(screen, responseMs, dtMs)`, `renderScreenToMain(ctx, screen, W, H, showGrid)`, `drawPixelGrid(ctx, ...)`.

### `src/components/Canvas.svelte`
The most complex component. Uses `onMount` for canvas setup, HiDPI scaling, double buffering, pre-warm, and a `requestAnimationFrame` loop that feeds frame times to its own clock and simulation instance. Uses `$effect` to reactively recompute reference tracks when lag/speed/path/report-rate props change. The canvas is at most 600px tall, sized to the space the layout gives it (a `ResizeObserver` on its area, plus pixel-ratio and fullscreen listeners) with the aspect ratio preserved; changing aspect ratio triggers a simulation reinit (reset + pre-warm). When `simPaused` is true the clock stops and the canvas keeps drawing the held state (true pause). When `penStopped` is true, pen movement stops but the simulation continues so b and c catch up. When screen mode is enabled, the render loop branches: brush stroke and pointer are drawn to the screen canvas, blended through the response time buffer, then composited onto the main canvas. Full-resolution overlays (pen, labels, circles, tracks) are drawn on top. Fullscreen/resize triggers a reset and pre-warm to prevent erratic brush trail artifacts.

### `src/lib/presets.js`
Validated, versioned preset storage. Storage key: `lag-viz-presets`. Format: `{ version: 1, presets: [{ name, data }] }` (older bare-array data still loads) where `data` is a complete settings object. Every preset is sanitized through `sanitizeSettings()` on read, save and import (out-of-range values clamped, wrong types replaced by defaults, numbers snapped to the slider grid), names are never truncated (typed names are limited to 60 characters, imported ones to 200), and imports are capped at 1 MB and 100 presets. Storage is an injectable adapter (`setStorage()`), so the module needs no DOM; reads of corrupt or unavailable storage return an empty list, and writes that fail throw a `PresetError` whose message the UI shows. Key exports: `loadPresetList()`, `savePreset(name, data)`, `deletePreset(name)`, `renamePreset(oldName, newName)`, `exportPresets()`, `importPresets(jsonString)`.

### `src/components/Presets.svelte`
Preset management UI component. Provides a save input field, a scrollable preset list (click to load, rename via pencil icon, delete via x button), and export/import buttons, and shows `PresetError` messages and import results (for example "Imported 2 presets (1 skipped, 3 values corrected).") in a status line. Calls into `presets.js` for all storage operations.

### `src/components/TopPanel.svelte`
Title bar and playback control buttons: Play/Pause (`simPaused`), Stop Pen/Resume Pen (`penStopped`), Restart, and Reset All. Buttons use fixed min-width to prevent layout shift when labels change.

### `src/components/SidePanel.svelte`
Left side panel containing all controls organized in collapsible sections (via CollapsibleSection). PEN, OS POINTER, and BRUSH sections have header checkboxes that control full visibility of their respective points (hiding the point also hides its label, track, and circle). Sections: PEN (pen speed, path type), TABLET (latency, smoothing, report rate), OS POINTER (pointer style, pointer size), BRUSH (brush latency/smoothing, size/spacing/trail, smooth stroke toggle), VIEW (unified labels/tracks/circles toggles for all points), DISPLAY (aspect ratio, screen mode + sub-options), PRESETS. All sections start collapsed on load. Custom dark-themed styling: dark checkboxes (#4a4a4a unchecked, #7089a8 checked), dark slider track (#4a4a4a) with slate gray thumb (#7089a8), dark dropdowns (#4a4a4a background, #ccc text), thin custom scrollbar (6px, #555) with 12px right padding for clearance.

### `src/components/CollapsibleSection.svelte`
Reusable collapsible section wrapper with a clickable header showing a ▼/▶ indicator and a title. The header button exposes `aria-expanded` and `aria-controls`; the body stays in the DOM and is hidden when collapsed. Supports an optional `headerExtra` snippet slot for placing controls (e.g., checkboxes) in the header row alongside the title.

### `src/components/Slider.svelte`
Reusable slider: label and value on the same row (label left-aligned, value right-aligned), range track underneath. The label is associated with the input, the value is an `<output>`, and keyboard focus is visible. Custom dark-themed styling. Bindable `value` prop.

### `src/App.svelte`
Root component. Declares the `settings` object (initialized from `DEFAULT_SETTINGS`) and the two playback flags. Composes `TopPanel`, `SidePanel` and `Canvas`; `Presets` is mounted inside `SidePanel`. Provides `getCurrentSettings()` to snapshot the settings into a plain object, `loadPreset(data)` to restore them from a preset (sanitized), and `resetAll()`. Each of Restart, Reset All and preset load re-mounts `Canvas` by bumping a key, and none of them touches the playback flags (see Reset rules).

## Data Flow

```
penSpeed → time increment → autoPosition(time, pathType) → posA
                                                              ↓
                                                        posHistory[]
                                                              ↓
                                    reportRate → fractional accumulator → skip non-report ticks
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
                                                                    smoothStroke? → Catmull-Rom + adaptive subdivision
                                                                                     or straight lineTo segments
                                                                                                      ↓
                                                                                  drawBrushStroke(brushSize, smoothStroke)
```

## Build & Deploy

- **Dev**: `bun run dev` (or `npm run dev`) — Vite dev server with HMR
- **Test**: `bun run test` — `node:test` unit tests in `tests/` covering settings validation, preset storage and the simulation/screen math (no browser needed)
- **Build**: `bun run build` — produces optimized static files in `dist/`. With `CI=true` the build fails on Svelte compiler warnings.
- **CI**: Pull requests run `bun install --frozen-lockfile`, tests and the build (`.github/workflows/ci.yml`)
- **Deploy**: Push to `master` → GitHub Actions runs the same checks, then deploys to GitHub Pages at `/WebDrawTabLagSim/`

## Module Dependency Graph

```
App.svelte
├── TopPanel.svelte
├── Canvas.svelte
│   ├── lib/constants.js
│   ├── lib/simulation.js ─── lib/constants.js, lib/animation.js
│   ├── lib/clock.js ──────── lib/constants.js
│   ├── lib/reference.js ──── lib/simulation.js, lib/animation.js
│   ├── lib/drawing.js ────── lib/constants.js
│   ├── lib/animation.js ──── lib/constants.js
│   └── lib/screen.js ─────── lib/constants.js
└── SidePanel.svelte
    ├── CollapsibleSection.svelte
    ├── Slider.svelte
    └── Presets.svelte (via children snippet)
        └── lib/presets.js ── lib/settings.js
```
