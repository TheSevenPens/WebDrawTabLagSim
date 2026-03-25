# User Manual

Drawing Tablet Lag Visualizer — an interactive animation that shows how lag accumulates between a pen tip, the OS pointer, and the brush stroke in a drawing tablet's input pipeline.

## What You're Looking At

The animation shows three points moving along a path:

- **a** (blue) — the pen tip. This is where the stylus physically touches the tablet. It represents the "ground truth" with zero lag.
- **b** (red) — the OS pointer. This is where the operating system thinks the cursor is. It lags behind the pen tip due to tablet report rate, driver latency, and pointer smoothing.
- **c** (green) — the brush stroke. This is where the drawing application renders the brush mark. It lags behind the OS pointer due to the brush engine's own processing.

Each point has a **dotted circle** around it and a **letter label** below it. A **track** (thin colored line) shows the full path each point will trace over one complete cycle.

The **brush stroke** is the painted mark trailing behind point c, simulating what you'd actually see on the canvas in a drawing application.

## Controls

### Top Panel

The top panel contains the title and playback controls:

- **Play/Pause** — freezes the entire visualization. Everything stops completely: pen, pointer, brush, all animation. Click again to resume.
- **Stop Pen/Resume Pen** — stops only the pen tip (a) from moving. Points b and c continue to catch up naturally to a's last position. Click again to resume pen movement.
- **Restart** — clears all history and restarts the animation from the beginning.
- **Reset All** — restores all settings to their default values and restarts.

### Side Panel (left of animation)

All controls are organized in collapsible sections. Click a section header (▶) to expand it, click again (▼) to collapse. All sections start collapsed on page load.

**PEN section**
- **Speed** (0.5–10) — how fast the pen tip moves along its path. Lower values make it easier to observe lag effects.
- **Path** — the shape the pen tip follows: Lissajous (pretzel-like curve), Circle, or Star (pentagram). Changing path type auto-restarts the animation.

**TABLET section**
- **Latency** (0–80) — pure time delay in animation frames. Higher values push b further behind a along the path.
- **Smoothing** (0–80) — exponential moving average (EMA) filter strength. At 0, b follows a's exact path (just delayed). Higher values make b's path smoother but more "cut-corner" — it traces a tighter, smaller version of a's path. When smoothing > 0, a separate red track appears showing b's actual trajectory.
- **Report Rate (Hz)** (1–60) — simulates the tablet's hardware update frequency. At 60 Hz, b updates every frame. At lower rates (try 2–5 Hz), b visibly "jumps" between positions, showing the stepping effect of low-frequency tablets.

**OS POINTER section**
- **Show OS pointer** — toggle visibility of the mouse cursor or crosshair drawn at point b.
- **Style** — dropdown to choose between a mouse cursor icon or a crosshair. The crosshair's center is positioned exactly on point b.
- **Size** — dropdown to scale the OS pointer: 1x, 2x, 4x, or 8x. Scales both the mouse cursor icon and the crosshair. Default is 1x.

**BRUSH section**
- **Brush Latency** (0–80) — time delay from b to c, same concept as pointer latency.
- **Brush Smoothing** (0–80) — EMA filter for the brush engine. When > 0, a green track appears showing c's smoothed trajectory.
- **Brush Size** (1–30) — size of the brush stroke. Default is 4.
- **Brush Spacing** (0–50) — minimum pixel distance c must travel before a new stroke segment is rendered. At 0 (default), rendering is continuous. Higher values create a segmented stroke that reveals how real brush engines sample at intervals. Try values of 20–40 to see the effect clearly.
- **Brush Trail** (5–300) — how many sample points the stroke retains. Reduce this if the stroke loops back into itself at high spacing values.
- **Show brush** — toggle the painted trail behind point c.
- **Smooth** — enables Catmull-Rom spline rendering for a smoother brush mark.

**VIEW section**
- **Labels** — toggle all letter labels (a, b, c) on or off at once.
- **Tracks** — toggle all track lines (the thin colored path lines) on or off at once.
- **Circles** — toggle all dotted circles around points a, b, and c on or off at once.

**DISPLAY section**
- **Aspect Ratio** — dropdown to set the canvas aspect ratio: 16:9 (default), 16:10, 4:3, or 1:1. The canvas height stays constant at 600px; width adjusts to match the selected ratio. Changing aspect ratio restarts the simulation.
- **Screen mode** — renders pointer and brush stroke onto a simulated pixelated display. When enabled, the following sub-options appear:
- **Resolution (px)** (80–320) — width of the simulated screen in pixels. Height is derived from the canvas aspect ratio. Lower values create larger, more visible pixels. Try 80 for dramatic pixelation.
- **Refresh Rate (Hz)** (10–144) — how often the simulated screen updates. At 60 Hz it updates every frame. At 10 Hz the pointer visibly jumps between positions, showing the "sample-and-hold" behavior of real LCDs.
- **Response Time (ms)** (1–50) — how fast individual pixels transition from one color to another. At 1ms transitions are near-instant. At 50ms you see visible ghosting — a smeared trail behind the moving pointer and brush stroke, caused by pixels still transitioning from their previous color.
- **Pixel grid** — shows grid lines between simulated pixels.

**PRESETS section** — see the Presets section below.

## Presets

The Presets panel appears in the side panel below the visibility checkboxes. It lets you save, load, and manage named configurations so you can quickly switch between different setups.

**Save a preset** — Type a name in the text field at the top of the Presets panel and click the Save button. All current settings (including pointer size and aspect ratio) are stored under that name.

**Load a preset** — Click the name of any saved preset in the list. All settings are instantly restored to the values stored in that preset.

**Rename a preset** — Click the pencil icon next to a preset name. The name becomes editable. Type the new name and press Enter to confirm.

**Delete a preset** — Click the x button next to a preset name. The preset is removed immediately.

**Export presets** — Click the Export button at the bottom of the Presets panel. A JSON file containing all your saved presets is downloaded to your computer.

**Import presets** — Click the Import button and select a previously exported JSON file. The imported presets are merged into your current list.

Presets persist in your browser's localStorage, so they survive page reloads and browser restarts. They are local to the browser and device where they were created. Use export/import to transfer presets between browsers or devices.

## Things to Try

### Freeze and inspect
Click **Play/Pause** to freeze the entire visualization in place. This is useful for inspecting the exact positions of a, b, and c at a specific moment. Click again to resume.

### Watch b and c catch up
While the animation is running, click **Stop Pen/Resume Pen**. The pen tip (a) stops moving, but b and c continue sliding toward a's final position, showing how lag drains out of the pipeline. Click again to resume pen movement.

### See pointer lag in action
Set Pointer Latency to 50, keep everything else at defaults. Watch how b trails behind a — this is the delay between where your pen physically is and where the OS thinks the cursor is.

### See smoothing cut corners
Set Pointer Smoothing to 30. Notice the red track (b's path) appears and is visibly tighter than the blue track (a's path). The smoothing rounds off the sharp parts of the curve. This is the trade-off tablet drivers make: smoother cursor movement at the cost of accuracy.

### See report rate stepping
Set Report Rate to 3 Hz. Point b now jumps between positions instead of gliding smoothly. This is what a very low-frequency tablet looks like. Increase to 10 Hz and the stepping becomes subtler but still visible.

### See brush spacing effects
Set Brush Spacing to 30. The stroke becomes segmented — visible gaps appear between sample points. This is how real brush engines work at high spacing values.

### Fix segmented strokes with smooth rendering
With Brush Spacing at 30, enable the **Smooth stroke** checkbox. The stroke transforms from angular segments to a flowing curve with gradual width transitions. This simulates the spline interpolation that quality brush engines use to handle high spacing.

### Compound lag
Set Pointer Latency to 40, Pointer Smoothing to 20, Brush Latency to 40, Brush Smoothing to 20. Watch how c falls dramatically behind a — the lags compound through the pipeline. This represents the worst-case user experience where every stage adds delay.

### Isolate brush lag
Set Pointer Latency and Pointer Smoothing to 0. Now a and b overlap perfectly. Set Brush Latency to 50. You can see the brush lag in isolation — the delay between where the OS pointer is and where the paint actually appears.

### Compare path shapes
Switch between Lissajous, Circle, and Star paths. The smoothing effect is most visible on the Star path because it has sharp corners that get rounded off. The Circle path shows pure latency (time offset) without any corner-cutting.

### See what a low-res screen looks like
Enable **Screen mode** and set Resolution to 80. The pointer and brush stroke become visibly pixelated — large blocky squares instead of smooth curves. The pen, labels, and tracks remain crisp because they represent ground truth, not what appears on the screen.

### See screen ghosting
With Screen mode on, set Response Time to 40ms. A ghostly trail appears behind the moving pointer and brush stroke. This is the same smearing artifact you see on slow LCD panels when dragging windows or scrolling text quickly.

### See refresh rate stepping on the display
With Screen mode on, set Refresh Rate to 10 Hz and Resolution to 80. The pixelated pointer jumps between positions roughly 10 times per second. Compare this to the smooth pen movement — the gap between the "real" position and what the screen shows is the display lag.

### Enable the pixel grid
With Screen mode on and Resolution at 80–100, enable **Pixel grid**. Thin lines appear between each simulated pixel, making the grid structure clearly visible — like zooming into a real monitor with a magnifying glass.

### Full pipeline lag
Combine everything: set Pointer Latency to 40, Pointer Smoothing to 15, Report Rate to 5 Hz, Brush Latency to 30, Brush Smoothing to 10, then enable Screen mode with Resolution 100, Refresh Rate 15 Hz, and Response Time 30ms. This shows the complete lag pipeline from pen tip to screen pixels — every stage adding delay and visual degradation.

## Understanding the Tracks

When smoothing is 0 for a given stage, that point follows the exact same path as its input (just time-delayed), so showing a separate track would be redundant. Tracks for b and c only appear when their respective smoothing values are greater than 0.

With smoothing enabled, compare the tracks:
- **Blue track** (a) — the original path
- **Red track** (b) — a tighter version of a's path (corners are rounded)
- **Green track** (c) — even tighter if brush smoothing is also applied

The further a track deviates from the blue track, the more positional accuracy is being sacrificed for smoothness.
