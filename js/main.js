import { COLORS, TIME_STEP_SCALE } from './constants.js';
import { state } from './state.js';
import {
  brushTrail, pushHistory, pushBrushTrail,
  computeCurrentPositions, forwardSimulateAtoB, forwardSimulateBtoC, preWarm,
} from './simulation.js';
import { drawBrushStroke, drawDashedPath, drawPosition, drawPointer, drawCrosshair, drawPen } from './drawing.js';
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

// --- Pre-warm ---
const W0 = canvas.width;
const H0 = canvas.height;
time = preWarm(W0, H0);

// --- Main render loop ---
function render() {
  time += state.penSpeed * TIME_STEP_SCALE;
  const W = canvas.width;
  const H = canvas.height;

  const posA = autoPosition(time, W, H);
  pushHistory(posA);

  const { posB, posC } = computeCurrentPositions(W, H);
  pushBrushTrail(posC);

  // Background
  ctx.fillStyle = COLORS.background;
  ctx.fillRect(0, 0, W, H);

  // Brush stroke trail
  drawBrushStroke(ctx, brushTrail);

  // Draw elements back to front
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

render();
