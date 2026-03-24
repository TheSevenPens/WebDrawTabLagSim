import { COLORS, HISTORY_SIZE, BRUSH_TRAIL_MAX, TIME_STEP_SCALE } from './constants.js';
import { state } from './state.js';
import { posHistory, brushTrail, getLaggedPos, getPathSegment, pushHistory, pushBrushTrail } from './history.js';
import { drawBrushStroke, drawDashedLine, drawDashedPath, drawPosition, drawPointer, drawCrosshair, drawPen } from './drawing.js';
import { autoPosition } from './animation.js';
import { initControls } from './controls.js';

// --- Canvas setup (double-buffered) ---
const canvas = document.getElementById('c');
const displayCtx = canvas.getContext('2d');
const offscreen = document.createElement('canvas');
const ctx = offscreen.getContext('2d');

function resize() {
  const w = Math.min(window.innerWidth - 40, 1100);
  canvas.width = w;
  canvas.height = Math.round(w * 0.5);
  offscreen.width = canvas.width;
  offscreen.height = canvas.height;
}

resize();
window.addEventListener('resize', resize);

// --- Controls ---
initControls();

// --- Time ---
let time = 0;

// --- Main render loop ---
function render() {
  time += state.penSpeed * TIME_STEP_SCALE;
  const W = canvas.width;
  const H = canvas.height;

  const posA = autoPosition(time, W, H);
  pushHistory(posA);

  const posB = getLaggedPos(state.pointerLag, W, H);
  const posC = getLaggedPos(state.pointerLag + state.brushLag, W, H);
  pushBrushTrail(posC);

  // Background
  ctx.fillStyle = COLORS.background;
  ctx.fillRect(0, 0, W, H);

  // Layers back to front
  drawBrushStroke(ctx, brushTrail);

  if (state.showLineAB) {
    const pathAB = getPathSegment(0, state.pointerLag);
    drawDashedPath(ctx, pathAB);
  }
  if (state.showLineBC) {
    const pathBC = getPathSegment(state.pointerLag, state.pointerLag + state.brushLag);
    drawDashedPath(ctx, pathBC);
  }

  drawPosition(ctx, posC, 'c', state.showCircleC, state.showC);
  if (state.showPointer) {
    if (state.pointerStyle === 'crosshair') drawCrosshair(ctx, posB.x, posB.y);
    else drawPointer(ctx, posB.x, posB.y);
  }
  drawPosition(ctx, posB, 'b', state.showCircleB, state.showB);
  drawPen(ctx, posA.x, posA.y);
  drawPosition(ctx, posA, 'a', state.showCircleA, state.showA);

  // Blit offscreen buffer to visible canvas
  displayCtx.drawImage(offscreen, 0, 0);

  requestAnimationFrame(render);
}

// --- Pre-warm animation ---
function preWarm() {
  const W = canvas.width;
  const H = canvas.height;
  for (let i = 0; i < HISTORY_SIZE; i++) {
    time += state.penSpeed * TIME_STEP_SCALE;
    pushHistory(autoPosition(time, W, H));
  }
  const totalLag = Math.round(state.pointerLag + state.brushLag);
  for (let i = 0; i < BRUSH_TRAIL_MAX; i++) {
    const idx = Math.max(0, posHistory.length - 1 - (BRUSH_TRAIL_MAX - i) - totalLag);
    if (idx >= 0 && idx < posHistory.length) {
      brushTrail.push({ x: posHistory[idx].x, y: posHistory[idx].y });
    }
  }
}

preWarm();
render();
