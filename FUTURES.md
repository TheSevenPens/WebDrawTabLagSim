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
- **Background color picker**: Let the user change the yellow background.
- **Dark/light theme toggle**: Switch between the current yellow canvas with dark page, or a white canvas with light page.
- **Higher DPI rendering**: Use `devicePixelRatio` to render at native resolution on Retina/HiDPI displays for sharper lines and text.

## New Controls

- **Animation path selector**: Choose between different paths — Lissajous, circle, figure-8, sine wave, spiral, or random walk.
- **Brush stroke width slider**: Control the maximum thickness of the tapered stroke.
- **Brush trail length slider**: Control how long the stroke trail persists.
- **Pause/play button**: Freeze the animation to inspect positions.
- **Reset button**: Clear history and restart the animation.
- **Preset configurations**: Save/load named configurations (e.g., "iPad Pro", "Wacom Cintiq", "High Lag Example").

## Interactive Mode (removed, could return)

- **Mouse/pen-driven mode**: Let the user drive position a with their actual mouse or pen input. Was previously implemented and removed for simplicity. Could return as a toggle.
- **Touch/stylus support**: Add pointer events for tablet/touch input in interactive mode.
- **Side-by-side comparison**: Two canvases running simultaneously with different lag settings so users can directly compare.

## Educational Features

- **Pipeline diagram overlay**: Show the pen-to-display pipeline from the presentation (slide 14) as an interactive overlay, highlighting which stage contributes to the currently visible lag.
- **Lag measurement display**: Show the pixel distance and estimated milliseconds between a→b and b→c in real time.
- **Slow motion mode**: Very slow playback to clearly see each position trailing behind.
- **Frame-by-frame stepping**: Step through one frame at a time to see exactly how lag accumulates.
- **Annotations**: Let users add text annotations to specific moments in the animation.

## Technical

- ~~**Extract to separate files**: Split HTML, CSS, and JS into separate files as the project grows.~~ Done.
- ~~**Use ES modules**: Organize drawing primitives, state management, and animation logic into modules.~~ Done — see `js/` directory.
- **Add unit tests**: Test `getLaggedPos`, `autoPosition`, and history buffer logic in `history.js` and `animation.js`.
- **Export as GIF/video**: Capture the animation as a GIF or video file for use in presentations.
- **Embed mode**: URL parameters to configure initial state, hide controls, and auto-play — useful for embedding in blog posts or slides.
- **Accessibility**: Add ARIA labels to controls, keyboard navigation for sliders, and a text description of the current animation state.
