import { COLORS, TIME_STEP_SCALE } from './constants.js';
import { state } from './state.js';
import {
  brushTrail, pushHistory, pushBrushTrail,
  computeCurrentPositions, preWarm,
} from './simulation.js';
import { drawBrushStroke, drawTrack, drawPosition, drawPointer, drawCrosshair, drawPen } from './drawing.js';
import { autoPosition, computeTrackA, computeSmoothedTrack } from './animation.js';
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
window.addEventListener('resize', () => {
  resize();
  recomputeTracks();
});

// --- Controls ---
initControls();

// --- Tracks ---
let trackA = [];
let trackB = [];
let trackC = [];

// Track the slider values so we know when to recompute
let prevPointerLatency = state.pointerLatency;
let prevPointerSmoothing = state.pointerSmoothing;
let prevBrushLatency = state.brushLatency;
let prevBrushSmoothing = state.brushSmoothing;
let prevPenSpeed = state.penSpeed;

function recomputeTracks() {
  const W = canvas.width;
  const H = canvas.height;
  trackA = computeTrackA(W, H, state.penSpeed);
  trackB = computeSmoothedTrack(trackA, state.pointerLatency, state.pointerSmoothing);
  trackC = computeSmoothedTrack(trackB, state.brushLatency, state.brushSmoothing);
}

function checkTrackRecompute() {
  if (
    state.pointerLatency !== prevPointerLatency ||
    state.pointerSmoothing !== prevPointerSmoothing ||
    state.brushLatency !== prevBrushLatency ||
    state.brushSmoothing !== prevBrushSmoothing ||
    state.penSpeed !== prevPenSpeed
  ) {
    prevPointerLatency = state.pointerLatency;
    prevPointerSmoothing = state.pointerSmoothing;
    prevBrushLatency = state.brushLatency;
    prevBrushSmoothing = state.brushSmoothing;
    prevPenSpeed = state.penSpeed;
    recomputeTracks();
  }
}

// --- Time ---
let time = 0;

// --- Pre-warm ---
const W0 = canvas.width;
const H0 = canvas.height;
time = preWarm(W0, H0);
recomputeTracks();

// --- Main render loop ---
function render() {
  time += state.penSpeed * TIME_STEP_SCALE;
  const W = canvas.width;
  const H = canvas.height;

  // Check if we need to recompute tracks (slider changed)
  checkTrackRecompute();

  const posA = autoPosition(time, W, H);
  pushHistory(posA);

  const { posB, posC } = computeCurrentPositions(W, H);
  pushBrushTrail(posC);

  // Background
  ctx.fillStyle = COLORS.background;
  ctx.fillRect(0, 0, W, H);

  // Deterministic tracks (back to front)
  if (state.showTrackA) {
    drawTrack(ctx, trackA, COLORS.circleA + '80');
  }
  if (state.showTrackB && state.pointerSmoothing > 0) {
    drawTrack(ctx, trackB, COLORS.circleB + '80');
  }
  if (state.showTrackC && state.brushSmoothing > 0) {
    drawTrack(ctx, trackC, COLORS.circleC + '80');
  }

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
