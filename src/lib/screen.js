import { COLORS } from './constants.js';

/**
 * Parse the background color hex string to RGB values.
 */
function parseHexColor(hex) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return { r, g, b };
}

const BG = parseHexColor(COLORS.background);

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

  // Float buffer for response time blending (RGBA per pixel)
  const colorBuffer = new Float32Array(width * height * 4);
  // Initialize to background color
  for (let i = 0; i < width * height; i++) {
    colorBuffer[i * 4] = 0;
    colorBuffer[i * 4 + 1] = 0;
    colorBuffer[i * 4 + 2] = 0;
    colorBuffer[i * 4 + 3] = 0;
  }

  // Temp canvas for IPS glow (cached to avoid re-allocation)
  const glowCanvas = document.createElement('canvas');
  const glowCtx = glowCanvas.getContext('2d');

  return {
    canvas,
    ctx,
    colorBuffer,
    width,
    height,
    refreshAccum: 0,
    glowCanvas,
    glowCtx,
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

  screen.colorBuffer = new Float32Array(width * height * 4);
  for (let i = 0; i < width * height; i++) {
    screen.colorBuffer[i * 4] = BG.r;
    screen.colorBuffer[i * 4 + 1] = BG.g;
    screen.colorBuffer[i * 4 + 2] = BG.b;
    screen.colorBuffer[i * 4 + 3] = 255;
  }
  screen.refreshAccum = 0;
}

/**
 * Check if it's time for a screen refresh based on elapsed time.
 * @returns {boolean} True if the screen should refresh this frame
 */
export function shouldRefresh(screen, dtMs, refreshRateHz) {
  screen.refreshAccum += dtMs;
  const interval = 1000 / refreshRateHz;
  if (screen.refreshAccum >= interval) {
    screen.refreshAccum -= interval;
    // Prevent accumulator runaway if tab was backgrounded
    if (screen.refreshAccum > interval) screen.refreshAccum = 0;
    return true;
  }
  return false;
}

/**
 * Blend the current screen canvas frame into the persistent color buffer.
 * Models LCD pixel response time — slow response = ghosting.
 */
export function commitFrame(screen, responseTimeMs, dtMs) {
  const { ctx, colorBuffer, width, height } = screen;
  const imageData = ctx.getImageData(0, 0, width, height);
  const pixels = imageData.data;

  // Blend factor: 1.0 = instant, small = ghosting
  const alpha = 1 - Math.exp(-dtMs / Math.max(responseTimeMs, 0.1));

  for (let i = 0; i < width * height; i++) {
    const pi = i * 4;
    colorBuffer[pi] += alpha * (pixels[pi] - colorBuffer[pi]);
    colorBuffer[pi + 1] += alpha * (pixels[pi + 1] - colorBuffer[pi + 1]);
    colorBuffer[pi + 2] += alpha * (pixels[pi + 2] - colorBuffer[pi + 2]);
    colorBuffer[pi + 3] += alpha * (pixels[pi + 3] - colorBuffer[pi + 3]);

    // Write back to image data
    pixels[pi] = Math.round(colorBuffer[pi]);
    pixels[pi + 1] = Math.round(colorBuffer[pi + 1]);
    pixels[pi + 2] = Math.round(colorBuffer[pi + 2]);
    pixels[pi + 3] = Math.round(colorBuffer[pi + 3]);
  }

  ctx.putImageData(imageData, 0, 0);
}

/**
 * Composite the screen layer onto the main canvas, with optional grid and glow.
 */
export function renderScreenToMain(mainCtx, screen, W, H, showGrid, showGlow) {
  mainCtx.save();
  mainCtx.imageSmoothingEnabled = false;
  mainCtx.drawImage(screen.canvas, 0, 0, W, H);
  mainCtx.restore();

  if (showGlow) {
    drawIpsGlow(mainCtx, screen, W, H);
  }
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

/**
 * IPS glow: blurred copy of screen composited with lighter blend mode.
 */
export function drawIpsGlow(mainCtx, screen, W, H) {
  const { glowCanvas, glowCtx } = screen;

  // Size glow canvas to logical dimensions (don't need full HiDPI here)
  if (glowCanvas.width !== W || glowCanvas.height !== H) {
    glowCanvas.width = W;
    glowCanvas.height = H;
  }

  // Draw scaled-up screen image
  glowCtx.imageSmoothingEnabled = false;
  glowCtx.clearRect(0, 0, W, H);
  glowCtx.drawImage(screen.canvas, 0, 0, W, H);

  // Blur proportional to pixel size
  const blurRadius = Math.max(2, (W / screen.width) * 1.5);
  glowCtx.filter = `blur(${blurRadius}px)`;
  glowCtx.drawImage(glowCanvas, 0, 0);
  glowCtx.filter = 'none';

  // Composite with lighter blend
  mainCtx.save();
  mainCtx.globalCompositeOperation = 'lighter';
  mainCtx.globalAlpha = 0.12;
  mainCtx.drawImage(glowCanvas, 0, 0);
  mainCtx.restore();
}
