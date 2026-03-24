# Futures

Ideas for fixes, improvements, and new directions.

## Fixes

- **Label collision avoidance**: Labels a, b, c can overlap when lag values are small. Could dynamically reposition labels based on proximity to each other.
- **Resize resets animation**: Resizing the window doesn't preserve the visual state well since canvas dimensions change but history positions use old coordinates. Could normalize positions to percentages.
- **Report rate and track sync**: The pre-computed tracks don't account for report rate stepping. At low report rates, B's actual path deviates from its smooth track. Could compute a stepped version of track B.

## Visual Improvements

- **Pen tilt/rotation**: Rotate the pen stylus to follow the direction of motion instead of always pointing straight up.
- **Brush stroke texture**: Add noise or texture to the brush stroke to make it look more like a real paint stroke.
- **Stroke color picker**: Let the user choose the brush stroke color.
- **Background color picker**: Let the user change the background color.
- **Dark/light theme toggle**: Switch between the current slate background with dark page, or a white canvas with light page.
- ~~**Higher DPI rendering**: Use `devicePixelRatio` to render at native resolution on Retina/HiDPI displays for sharper lines and text.~~ Done — `Canvas.svelte` scales backing store by `devicePixelRatio`.
- **Track styling options**: Allow dashed or dotted tracks, adjustable track thickness, or gradient coloring along the track to indicate direction of travel.

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
- ~~**Brush stroke width slider**: Control the maximum thickness of the tapered stroke.~~ Done — Brush Size slider (0.1–3).
- **Pause/play button**: Freeze the animation to inspect positions.
- **Reset button**: Clear history and restart the animation.
- **Preset configurations**: Save/load named configurations (e.g., "iPad Pro", "Wacom Cintiq", "High Lag Example").
- ~~**Report rate slider**: Simulate how frequently the tablet sends position updates.~~ Done — Report Rate (Hz) slider, 1–60 Hz, grouped under the Pointer controls.

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
