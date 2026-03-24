# Futures

Ideas for fixes, improvements, and new directions.

## Fixes

- **Label collision avoidance**: Labels a, b, c can overlap when lag values are small. Could dynamically reposition labels based on proximity to each other.
- **Resize resets animation**: Resizing the window doesn't preserve the visual state well since canvas dimensions change but history positions use old coordinates. Could normalize positions to percentages.
- **Brush trail wrapping**: At very high speeds, the brush trail can loop over itself in ways that look odd. Could limit trail length dynamically based on speed.

## Visual Improvements

- **Pen tilt/rotation**: Rotate the pen stylus to follow the direction of motion instead of always pointing straight up.
- **Brush stroke texture**: Add noise or texture to the brush stroke to make it look more like a real paint stroke.
- **Stroke color picker**: Let the user choose the brush stroke color.
- **Background color picker**: Let the user change the background color.
- **Dark/light theme toggle**: Switch between the current slate background with dark page, or a white canvas with light page.
- **Higher DPI rendering**: Use `devicePixelRatio` to render at native resolution on Retina/HiDPI displays for sharper lines and text.
- **Track styling options**: Allow dashed or dotted tracks, adjustable track thickness, or gradient coloring along the track to indicate direction of travel.

## New Controls

- **Animation path selector**: Choose between different paths — Lissajous (various frequency ratios), circle, figure-8, sine wave, spiral, or random walk.
- **Lissajous frequency ratio selector**: Let the user control the X and Y frequencies to change path complexity (e.g., 1:2 for figure-8, 2:3 for pretzel, higher ratios for more loops).
- **Brush stroke width slider**: Control the maximum thickness of the tapered stroke.
- **Brush trail length slider**: Control how long the stroke trail persists.
- **Pause/play button**: Freeze the animation to inspect positions.
- **Reset button**: Clear history and restart the animation.
- **Preset configurations**: Save/load named configurations (e.g., "iPad Pro", "Wacom Cintiq", "High Lag Example").

## Interactive Mode (removed, could return)

- **Mouse/pen-driven mode**: Let the user drive position A with their actual mouse or pen input. Was previously implemented and removed for simplicity. Could return as a toggle.
- **Touch/stylus support**: Add pointer events for tablet/touch input in interactive mode.
- **Side-by-side comparison**: Two canvases running simultaneously with different lag settings so users can directly compare.

## Smoothing Model Enhancements

- **Alternative filter types**: Replace or augment EMA with other smoothing algorithms — moving average, Gaussian kernel, Kalman filter, spring-damper (critically damped for no overshoot, underdamped for wobble).
- **Smoothing comparison mode**: Show multiple tracks simultaneously using different smoothing algorithms on the same input, to visualize how filter choice affects path deviation.
- **Per-axis smoothing**: Allow different smoothing parameters for X and Y axes, modeling tablets that may have different response characteristics horizontally vs vertically.
- **Velocity-dependent smoothing**: Increase smoothing at low speeds (common in real tablet drivers) and reduce it at high speeds, showing how adaptive smoothing affects the path.

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
