// Longest frame gap (ms) the refresh clock will catch up on
const MAX_REFRESH_DT_MS = 250;

// With anti-aliasing off, a pixel counts as covered when its geometric coverage reaches this
const COVERAGE_THRESHOLD = 128;

/**
 * The persistent pixel state used for response-time blending.
 *
 * Four floats per pixel: red, green and blue premultiplied by alpha (0..255),
 * then alpha (0..255). Premultiplied, so a pixel fading out keeps its hue and
 * only loses opacity, rather than darkening toward black as it goes.
 *
 * Every screen, new or resized, starts fully transparent, so the tracks
 * underneath show through and a resize fades the same way a fresh screen does.
 */
export function createColorBuffer(width, height) {
  return new Float32Array(width * height * 4);
}

/**
 * Create a simulated screen state object.
 * @param {number} width - Screen width in simulated pixels
 * @param {number} height - Screen height in simulated pixels
 * @returns {object} Screen state
 */
export function createScreen(width, height) {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingEnabled = false;

  return {
    canvas,
    ctx,
    colorBuffer: createColorBuffer(width, height),
    width,
    height,
    refreshAccum: 0,
  };
}

/**
 * Resize the screen when resolution changes.
 */
export function resizeScreen(screen, width, height) {
  screen.width = width;
  screen.height = height;
  screen.canvas.width = width;
  screen.canvas.height = height;
  screen.ctx.imageSmoothingEnabled = false;

  screen.colorBuffer = createColorBuffer(width, height);
  screen.refreshAccum = 0;
}

/**
 * Count how many simulated screen refreshes elapsed during this frame.
 * Several can be due when the simulated refresh rate exceeds the host frame
 * rate; the caller redraws once and blends for `count * interval` ms, which is
 * equivalent to blending `count` times toward the same target.
 * @returns {number} Number of refreshes due (0 if none)
 */
export function consumeRefreshes(screen, dtMs, refreshRateHz) {
  // Cap dt so a backgrounded tab doesn't produce a huge catch-up
  screen.refreshAccum += Math.min(dtMs, MAX_REFRESH_DT_MS);
  const interval = 1000 / refreshRateHz;
  const count = Math.floor(screen.refreshAccum / interval);
  screen.refreshAccum -= count * interval;
  return count;
}

/**
 * Decide what the screen layer does this frame.
 *  - dirty (new, reset or resized screen, or a visual edit while frozen):
 *    redraw and snap to the target instead of fading in
 *  - frozen otherwise: leave the layer untouched, so held pixels and
 *    response-time ghosts are preserved
 *  - running: redraw once if any simulated refreshes are due, blending for
 *    all of them
 * @returns {{ redraw: boolean, blendMs: number }}
 */
export function planScreenUpdate(screen, { dirty, frozen, dtMs, refreshRateHz }) {
  const count = frozen ? 0 : consumeRefreshes(screen, dtMs, refreshRateHz);
  if (dirty) return { redraw: true, blendMs: Infinity };
  return { redraw: count > 0, blendMs: count * 1000 / refreshRateHz };
}

// An opaque version of a color: the same hue with the alpha dropped
const RGBA_COLOR = /^rgba\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*[\d.]+\s*\)$/i;

export function opaqueColor(style) {
  if (typeof style !== 'string') return style;
  const rgba = RGBA_COLOR.exec(style);
  if (rgba) return `rgb(${rgba[1]}, ${rgba[2]}, ${rgba[3]})`;
  if (/^#[0-9a-f]{8}$/i.test(style)) return style.slice(0, 7);
  if (/^#[0-9a-f]{4}$/i.test(style)) return style.slice(0, 4);
  return style;
}

/**
 * Wrap a 2D context so everything drawn through it is fully opaque: colors lose
 * their alpha and globalAlpha stays 1. Drawing the same content through this
 * wrapper yields a pure geometric coverage mask, free of the content's own
 * (intentional) transparency.
 */
export function opaqueContext(ctx) {
  return new Proxy(ctx, {
    get(target, key) {
      const value = target[key];
      return typeof value === 'function' ? value.bind(target) : value;
    },
    set(target, key, value) {
      if (key === 'strokeStyle' || key === 'fillStyle') target[key] = opaqueColor(value);
      else if (key === 'globalAlpha') target[key] = 1;
      else target[key] = value;
      return true;
    },
  });
}

/**
 * Remove anti-aliasing from the frame just drawn on the screen canvas.
 *
 * Canvas 2D cannot turn vector anti-aliasing off, and an edge pixel's alpha mixes
 * two things: how much of the pixel the shape covers (anti-aliasing) and how
 * transparent the paint is (the brush tail is deliberately faint). So the content
 * is drawn a second time, fully opaque, to get coverage alone. A pixel is then
 * either covered (>= COVERAGE_THRESHOLD) or not drawn, and a covered pixel keeps
 * the paint's own opacity, recovered as drawn alpha / coverage.
 */
function aliasFrame(screen, draw) {
  const { ctx, width, height } = screen;
  const frame = ctx.getImageData(0, 0, width, height);
  const pixels = frame.data;

  ctx.clearRect(0, 0, width, height);
  draw(ctx, { coverage: true });
  const coverage = ctx.getImageData(0, 0, width, height).data;

  for (let i = 0; i < width * height; i++) {
    const pi = i * 4;
    const cover = coverage[pi + 3];
    if (cover >= COVERAGE_THRESHOLD) {
      pixels[pi + 3] = Math.min(255, Math.round((pixels[pi + 3] / cover) * 255));
    } else {
      pixels[pi] = pixels[pi + 1] = pixels[pi + 2] = pixels[pi + 3] = 0;
    }
  }
  ctx.putImageData(frame, 0, 0);
}

/**
 * Advance the screen layer by `simMs` of simulated time: redraw it if the plan
 * says so, then blend into the persistent pixel buffer.
 *
 * Call this once per simulation tick, right after the tick, with that tick's
 * state. Response time then integrates the same sequence of states whatever
 * the host frame rate is; grouping several ticks into one host frame (or
 * running none) cannot change the result. Compositing onto the main canvas
 * still happens once per host frame.
 *
 * @param {object} screen - from createScreen()
 * @param {object} opts - { dirty, frozen, simMs, refreshRateHz, responseTimeMs, antiAlias }
 * @param {(ctx: CanvasRenderingContext2D, mode: { coverage: boolean }) => void} draw -
 *   draws this tick's pointer/stroke. With anti-aliasing off it is called a second time
 *   with `mode.coverage` true and should draw the same geometry (it may use
 *   opaqueContext() to drop the content's own transparency)
 * @returns {boolean} whether the layer was redrawn
 */
export function advanceScreen(
  screen,
  { dirty, frozen, simMs, refreshRateHz, responseTimeMs, antiAlias = true },
  draw,
) {
  const plan = planScreenUpdate(screen, { dirty, frozen, dtMs: simMs, refreshRateHz });
  if (!plan.redraw) return false;

  // Clear to transparent (so tracks show through), then draw at screen resolution
  screen.ctx.clearRect(0, 0, screen.width, screen.height);
  draw(screen.ctx, { coverage: false });
  if (!antiAlias) aliasFrame(screen, draw);

  // Response time blending (ghosting); an infinite interval snaps to the target
  commitFrame(screen, responseTimeMs, plan.blendMs);
  return true;
}

/**
 * Blend the current screen canvas frame into the persistent color buffer.
 * Models LCD pixel response time — slow response = ghosting.
 *
 * Blending is done on premultiplied color, so a fading pixel keeps its hue and
 * loses only opacity.
 *
 * @param {object} screen
 * @param {number} responseTimeMs - pixel response time constant
 * @param {number} dtMs - simulated time to blend over (Infinity snaps to the target)
 */
export function commitFrame(screen, responseTimeMs, dtMs) {
  const { ctx, colorBuffer, width, height } = screen;
  const imageData = ctx.getImageData(0, 0, width, height);
  const pixels = imageData.data;

  // Blend factor: 1.0 = instant, small = ghosting
  const k = 1 - Math.exp(-dtMs / Math.max(responseTimeMs, 0.1));

  for (let i = 0; i < width * height; i++) {
    const pi = i * 4;

    // Target pixel (what was just drawn), as premultiplied color
    const targetAlpha = pixels[pi + 3];
    const coverage = targetAlpha / 255;

    colorBuffer[pi] += k * (pixels[pi] * coverage - colorBuffer[pi]);
    colorBuffer[pi + 1] += k * (pixels[pi + 1] * coverage - colorBuffer[pi + 1]);
    colorBuffer[pi + 2] += k * (pixels[pi + 2] * coverage - colorBuffer[pi + 2]);
    colorBuffer[pi + 3] += k * (targetAlpha - colorBuffer[pi + 3]);

    // Write back as straight (non-premultiplied) color for putImageData
    const a = colorBuffer[pi + 3];
    const scale = a > 0 ? 255 / a : 0;
    pixels[pi] = Math.min(255, Math.round(colorBuffer[pi] * scale));
    pixels[pi + 1] = Math.min(255, Math.round(colorBuffer[pi + 1] * scale));
    pixels[pi + 2] = Math.min(255, Math.round(colorBuffer[pi + 2] * scale));
    pixels[pi + 3] = Math.round(a);
  }

  ctx.putImageData(imageData, 0, 0);
}

/**
 * Composite the screen layer onto the main canvas, with optional grid.
 */
export function renderScreenToMain(mainCtx, screen, W, H, showGrid) {
  mainCtx.save();
  mainCtx.imageSmoothingEnabled = false;
  mainCtx.drawImage(screen.canvas, 0, 0, W, H);
  mainCtx.restore();

  if (showGrid) {
    drawPixelGrid(mainCtx, screen.width, screen.height, W, H);
  }
}

/**
 * Draw thin lines at pixel boundaries.
 */
export function drawPixelGrid(ctx, screenW, screenH, W, H) {
  const pixelW = W / screenW;
  const pixelH = H / screenH;

  ctx.save();
  ctx.strokeStyle = 'rgba(0,0,0,0.15)';
  ctx.lineWidth = 0.5;
  ctx.beginPath();

  // Vertical lines
  for (let i = 1; i < screenW; i++) {
    const x = i * pixelW;
    ctx.moveTo(x, 0);
    ctx.lineTo(x, H);
  }
  // Horizontal lines
  for (let j = 1; j < screenH; j++) {
    const y = j * pixelH;
    ctx.moveTo(0, y);
    ctx.lineTo(W, y);
  }

  ctx.stroke();
  ctx.restore();
}

