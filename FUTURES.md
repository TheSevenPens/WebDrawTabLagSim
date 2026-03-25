# Futures

Ideas for fixes, improvements, and new directions.

## Fixes

- **Label collision avoidance**: Labels a, b, c can overlap when lag values are small. Could dynamically reposition labels based on proximity to each other.
- ~~**Resize resets animation**: Resizing the window doesn't preserve the visual state well since canvas dimensions change but history positions use old coordinates. Could normalize positions to percentages.~~ Done — fullscreen/resize now resets and pre-warms the simulation.
- **Report rate and track sync**: The pre-computed tracks don't account for report rate stepping. At low report rates, B's actual path deviates from its smooth track. Could compute a stepped version of track B.

## Visual Improvements

- **Pen tilt/rotation**: Rotate the pen stylus to follow the direction of motion instead of always pointing straight up.
- **Brush stroke texture**: Add noise or texture to the brush stroke to make it look more like a real paint stroke.
- **Stroke color picker**: Let the user choose the brush stroke color.
- **Background color picker**: Let the user change the background color.
- **Dark/light theme toggle**: Switch between the current slate background with dark page, or a white canvas with light page.
- ~~**Higher DPI rendering**: Use `devicePixelRatio` to render at native resolution on Retina/HiDPI displays for sharper lines and text.~~ Done — `Canvas.svelte` scales backing store by `devicePixelRatio`.
- **Track styling options**: Allow dashed or dotted tracks, adjustable track thickness, or gradient coloring along the track to indicate direction of travel.

## Screen Simulation

- ~~**Screen mode**: Render pointer and brush stroke onto a simulated low-resolution pixelated display.~~ Done — toggleable via Screen mode checkbox.
- ~~**Screen refresh rate**: Simulate display update frequency (10–144 Hz) with sample-and-hold behavior between refreshes.~~ Done — Refresh Rate slider.
- ~~**Pixel response time**: Model LCD pixel transition speed with per-pixel exponential blending for ghosting effects.~~ Done — Response Time slider (1–50ms).
- ~~**Pixel grid**: Show grid lines between simulated pixels.~~ Done — Pixel grid checkbox.
- ~~**IPS glow**: Bloom effect simulating IPS panel backlight bleed.~~ Done, then removed — feature was cut in a later redesign.
- **RGB sub-pixel rendering**: Render each simulated pixel as three vertical R/G/B sub-columns, modeling real LCD sub-pixel structure.
- **Panel type presets**: Preset configurations for common panel types (TN, IPS, VA, OLED) with different response time curves and color characteristics.
- **Overdrive simulation**: Model the overshoot artifacts that occur when LCD panels use aggressive pixel transition acceleration.
- **Motion blur visualization**: Show how sample-and-hold displays create perceived motion blur proportional to 1/refresh_rate.
- **Variable refresh rate (VRR)**: Simulate adaptive sync / G-Sync / FreeSync where refresh rate matches the content update rate.

## CRT / Display Shader Effects

CRT shaders simulate the visual characteristics of real physical displays — scanlines, phosphor sub-pixels, bloom, and other artifacts that make a rendered image look like it is being viewed on an actual monitor. Adding even basic CRT effects to the simulated screen would dramatically increase the "this is a real display" feel.

### Relevant Effects

- **Scanlines**: Alternating dark horizontal lines between pixel rows, simulating the gap between electron beam passes on a CRT or the black matrix on an LCD. Visually, every other horizontal line is dimmed.
- **RGB phosphor / sub-pixels**: Each simulated pixel is drawn as three narrow vertical strips — red, green, and blue — modeling real LCD sub-pixel structure or CRT phosphor triads. The per-channel color is derived from the pixel's actual RGB value.
- **Bloom / halation**: Bright pixels bleed light into neighboring dark areas, simulating phosphor glow or lens diffusion. Creates a soft halo around high-contrast edges.
- **Curvature (barrel distortion)**: Warps the image outward to mimic a curved CRT face. Probably not useful for this app since we are simulating flat panels, but worth noting.
- **Vignette**: Edges of the screen are darker than the center, simulating light falloff in CRT electron guns or lens optics.

### Implementation Options

**Option A: Canvas 2D (recommended first step)**

Draw scanlines as semi-transparent black horizontal lines across the composited screen image. Draw RGB sub-pixels by replacing each pixel rect with three tinted sub-rects (R, G, B), each one-third pixel width, with color intensity derived from the source pixel's channel values. At 160px resolution, the screen is ~160x100 = 16,000 pixels, times 3 sub-rects = ~48K `fillRect` calls — negligible performance cost. All rendering lives in `renderScreenToMain` in `screen.js`, applied after the response time buffer compositing and before the pixel grid overlay.

**Option B: WebGL post-processing shader**

Write a GLSL fragment shader that applies scanlines, sub-pixels, bloom, and vignette in a single GPU pass. Zero CPU cost for the effects themselves. However, this requires setting up a WebGL context alongside the existing Canvas 2D context (or replacing it), managing shader compilation, and passing the screen texture to the GPU. Significantly more complexity. Best reserved for bloom or other effects that require multi-pixel sampling.

**Option C: CSS filters**

Limited capability. Scanlines could be faked with a `repeating-linear-gradient` overlay, but RGB sub-pixels cannot be achieved with CSS alone. Not viable for the full effect set.

### Recommendation

Start with **Canvas 2D scanlines + RGB sub-pixels (Option A)**. This delivers roughly 90% of the visual impact with minimal code. Scanlines and sub-pixel rendering are the two effects that most strongly sell the "real screen" illusion. Add WebGL (Option B) later only if bloom, halation, or other exotic multi-pixel effects are needed.

### New Controls Needed

Two new checkboxes in the **DISPLAY** section of the side panel, conditional on screen mode being enabled:

- **Scanlines** checkbox — toggles scanline overlay
- **Sub-pixels** checkbox — toggles RGB sub-pixel rendering

### Estimated Impact

Approximately 30 lines of additional code in `screen.js` (inside `renderScreenToMain`), two new `$state` variables and two checkboxes in the UI, negligible performance cost, and a dramatically more screen-like appearance for the simulated display.

## Brush Engine Enhancements

- ~~**Brush spacing (distance threshold)**: Simulate brush engines that only render when the cursor has moved a minimum distance.~~ Done — Brush Spacing slider (0–50px).
- ~~**Brush trail length**: Control how many points the trail retains to prevent overlap at high spacing.~~ Done — Brush Trail slider (5–300).
- ~~**Smooth stroke rendering**: Catmull-Rom spline interpolation with 16× subdivision for seamless width transitions.~~ Done — Smooth stroke checkbox.
- **Configurable subdivision count**: Let the user control the number of subdivisions per segment (currently hardcoded at 16). Higher values = smoother but more expensive.
- **Configurable Catmull-Rom tension**: Expose the spline tension parameter (currently 0.5). Lower tension = tighter curves that hug control points; higher tension = looser, more sweeping curves.
- **Pressure simulation**: Simulate pen pressure by varying brush width based on velocity — slow movement = heavy/wide, fast = thin/light, mimicking how real styluses work.
- **Dab-based rendering**: Instead of connected line segments, render individual circular or elliptical dabs at each sample point (how Photoshop and many brush engines actually work). At low spacing, dabs overlap to form a smooth stroke; at high spacing, individual dabs become visible.
- **Stamp rotation**: Rotate brush dabs to follow the stroke direction, simulating calligraphic or flat brush effects.
- **Opacity buildup**: Model how overlapping dabs accumulate opacity, creating darker areas where the stroke curves back on itself.

## New Controls

- ~~**Animation path selector**: Choose between different paths.~~ Done — Lissajous, Circle, Star via dropdown.
- **More path types**: Sine wave, spiral, figure-8, random walk, or custom user-drawn paths.
- **Lissajous frequency ratio selector**: Let the user control the X and Y frequencies to change path complexity (e.g., 1:2 for figure-8, 2:3 for pretzel, higher ratios for more loops).
- ~~**Brush stroke width slider**: Control the maximum thickness of the tapered stroke.~~ Done — Brush Size slider (1–30).
- ~~**Pause/play button**: Freeze the animation to inspect positions.~~ Done — Play/Pause button in TopPanel (true freeze, entire visualization stops). Stop Pen/Resume Pen button also available (only stops pen movement, b and c catch up naturally).
- ~~**Reset button**: Clear history and restart the animation.~~ Done — Restart and Reset All buttons in TopPanel.
- ~~**Preset configurations**: Save/load named configurations (e.g., "iPad Pro", "Wacom Cintiq", "High Lag Example").~~ Done — Presets panel in the side panel with save, load, rename, delete, export, and import. All settings stored in localStorage under `lag-viz-presets`.
- **Cloud sync presets**: Sync saved presets across devices via a cloud backend or service like Firebase.
- **Shareable preset URLs**: Encode preset data into a URL so configurations can be shared as links without needing file export.
- **Built-in factory presets**: Ship a set of default presets modeling real devices (e.g., "iPad Pro", "Wacom Cintiq 16", "Surface Pro") so new users can explore common configurations immediately.
- ~~**Report rate slider**: Simulate how frequently the tablet sends position updates.~~ Done — Report Rate (Hz) slider, 1–60 Hz, grouped in the TABLET section.

## Interactive Mode (removed, could return)

- **Mouse/pen-driven mode**: Let the user drive position A with their actual mouse or pen input. Was previously implemented and removed for simplicity. Could return as a toggle.
- **Touch/stylus support**: Add pointer events for tablet/touch input in interactive mode.
- **Side-by-side comparison**: Two canvases running simultaneously with different lag settings so users can directly compare.

## Smoothing Model Enhancements

- **Alternative filter types**: Replace or augment EMA with other smoothing algorithms — moving average, Gaussian kernel, Kalman filter, spring-damper (critically damped for no overshoot, underdamped for wobble).
- **Smoothing comparison mode**: Show multiple tracks simultaneously using different smoothing algorithms on the same input, to visualize how filter choice affects path deviation.
- **Per-axis smoothing**: Allow different smoothing parameters for X and Y axes, modeling tablets that may have different response characteristics horizontally vs vertically.
- **Velocity-dependent smoothing**: Increase smoothing at low speeds (common in real tablet drivers) and reduce it at high speeds, showing how adaptive smoothing affects the path.

## Report Rate Enhancements

- **Variable report rate**: Simulate tablets that change report rate under load or based on USB polling interval.
- **Interpolated report rate**: Show what happens when the OS interpolates between reports (linear interpolation between last two reported positions) vs raw stepping.
- **Report rate jitter**: Add random variation to the report interval to simulate real-world USB timing inconsistencies.

## Educational Features

- **Pipeline diagram overlay**: Show the pen-to-display pipeline as an interactive overlay, highlighting which stage contributes to the currently visible lag.
- **Lag measurement display**: Show the pixel distance and estimated milliseconds between A→B and B→C in real time.
- **Slow motion mode**: Very slow playback to clearly see each position trailing behind.
- **Frame-by-frame stepping**: Step through one frame at a time to see exactly how lag accumulates.
- **Annotations**: Let users add text annotations to specific moments in the animation.
- **Corner deviation metric**: Quantify how much smoothing deviates from the original path at corners — display as a real-time number or heatmap on the track.

## Technical

- ~~**Extract to separate files**: Split HTML, CSS, and JS into separate files as the project grows.~~ Done.
- ~~**Use ES modules**: Organize drawing primitives, state management, and animation logic into modules.~~ Done — see `src/lib/`.
- ~~**Deterministic tracks**: Pre-compute the steady-state paths for B and C accounting for smoothing, so tracks accurately reflect each point's trajectory.~~ Done — `computeSmoothedTrack()` in `src/lib/animation.js`.
- ~~**Migrate to Svelte + Vite**: Component-based UI with reactive state, HMR dev server, optimized production builds.~~ Done — Svelte 5 with `$state` runes, deployed via GitHub Actions to GitHub Pages.
- **Add unit tests**: Test `computeSmoothedTrack`, `autoPosition`, `emaStep`, and history buffer logic using Vitest.
- **Export as GIF/video**: Capture the animation as a GIF or video file for use in presentations.
- **Embed mode**: URL parameters to configure initial state, hide controls, and auto-play — useful for embedding in blog posts or slides.
- **Accessibility**: Add ARIA labels to controls, keyboard navigation for sliders, and a text description of the current animation state.
- **State serialization**: Encode the full slider/toggle state into a URL hash so configurations can be shared as links.
- **Performance profiling**: At high subdivision counts or brush trail lengths, the render loop may become CPU-bound. Could profile and optimize the hot path, or consider WebGL for the stroke rendering.

## UI / Layout

- **Remember collapsed section state**: Persist which sections are expanded/collapsed in localStorage so users don't have to re-expand their preferred sections on every page load.
- **Responsive side panel**: Allow the side panel to be resized by dragging, or auto-collapse on narrow viewports.
- **Keyboard shortcuts**: Add hotkeys for common actions (space for play/pause, R for restart, etc.).
