// Longest frame gap (ms) the refresh clock will catch up on
const MAX_REFRESH_DT_MS = 250;

// With anti-aliasing off, a pixel counts as covered when its alpha reaches this
const ALIAS_ALPHA_THRESHOLD = 128;

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
 * @param {(ctx: CanvasRenderingContext2D) => void} draw - draws this tick's pointer/stroke
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
  draw(screen.ctx);

  // Response time blending (ghosting); an infinite interval snaps to the target
  commitFrame(screen, responseTimeMs, plan.blendMs, { antiAlias });
  return true;
}

/**
 * Blend the current screen canvas frame into the persistent color buffer.
 * Models LCD pixel response time — slow response = ghosting.
 *
 * Blending is done on premultiplied color, so a fading pixel keeps its hue and
 * loses only opacity.
 *
 * Canvas 2D cannot turn vector anti-aliasing off, so with `antiAlias: false`
 * the drawn frame is thresholded instead: a pixel is either fully covered or
 * not drawn at all, which gives hard, jagged edges at the screen's resolution.
 *
 * @param {object} screen
 * @param {number} responseTimeMs - pixel response time constant
 * @param {number} dtMs - simulated time to blend over (Infinity snaps to the target)
 * @param {{ antiAlias?: boolean }} [opts]
 */
export function commitFrame(screen, responseTimeMs, dtMs, { antiAlias = true } = {}) {
  const { ctx, colorBuffer, width, height } = screen;
  const imageData = ctx.getImageData(0, 0, width, height);
  const pixels = imageData.data;

  // Blend factor: 1.0 = instant, small = ghosting
  const k = 1 - Math.exp(-dtMs / Math.max(responseTimeMs, 0.1));

  for (let i = 0; i < width * height; i++) {
    const pi = i * 4;

    // Target pixel (what was just drawn), as premultiplied color
    let targetAlpha = pixels[pi + 3];
    if (!antiAlias) targetAlpha = targetAlpha >= ALIAS_ALPHA_THRESHOLD ? 255 : 0;
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

