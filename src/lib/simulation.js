/**
 * simulation.js
 *
 * Models the lag pipeline: A (pen tip) → B (OS pointer) → C (brush stroke).
 *
 * Each stage has two parameters:
 *   - latency: pure time delay in frames (B sees A's position from N frames ago)
 *   - smoothing: EMA filter strength (0 = passthrough, higher = more smoothing)
 *
 * The EMA formula:  output = alpha * input + (1 - alpha) * prev_output
 * where alpha = 1 / (1 + smoothing).   smoothing=0 → alpha=1 → no filtering.
 *
 * All functions accept lag parameters explicitly (no global state dependency).
 */

import { HISTORY_SIZE, BRUSH_TRAIL_MAX, TIME_STEP_SCALE } from './constants.js';
import { autoPosition } from './animation.js';

// --- Raw position history for A (pen tip) ---
export const posHistory = [];
export const brushTrail = [];

// --- EMA filter state for B and C ---
const emaB = { x: null, y: null };
const emaC = { x: null, y: null };

// --- B position history (needed so C can delay off B's output) ---
const posBHistory = [];

/**
 * Compute EMA alpha from the smoothing slider value.
 * smoothing=0 → alpha=1 (passthrough), smoothing=100 → alpha≈0.01 (heavy filter).
 */
function emaAlpha(smoothing) {
  return 1 / (1 + smoothing);
}

/**
 * Apply one EMA step.  Returns new filtered position.
 * `st` is { x, y } mutable accumulator; mutated in place and returned.
 */
function emaStep(st, input, alpha) {
  if (st.x === null) {
    st.x = input.x;
    st.y = input.y;
  } else {
    st.x = alpha * input.x + (1 - alpha) * st.x;
    st.y = alpha * input.y + (1 - alpha) * st.y;
  }
  return { x: st.x, y: st.y };
}

/**
 * Get a raw (unsmoothed) position from history, delayed by `latencyFrames`.
 */
function getDelayedPos(latencyFrames, fallbackW, fallbackH) {
  const idx = Math.max(0, posHistory.length - 1 - Math.round(latencyFrames));
  return posHistory[idx] || { x: fallbackW / 2, y: fallbackH / 2 };
}

function pushBHistory(pos) {
  posBHistory.push({ x: pos.x, y: pos.y });
  if (posBHistory.length > HISTORY_SIZE) posBHistory.shift();
}

function getBDelayedPos(latencyFrames, W, H) {
  const idx = Math.max(0, posBHistory.length - 1 - Math.round(latencyFrames));
  return posBHistory[idx] || { x: W / 2, y: H / 2 };
}

/**
 * Push a new A position into the history ring buffer.
 */
export function pushHistory(pos) {
  posHistory.push({ x: pos.x, y: pos.y });
  if (posHistory.length > HISTORY_SIZE) posHistory.shift();
}

/**
 * Push a C position into the brush trail ring buffer.
 */
export function pushBrushTrail(pos) {
  brushTrail.push({ x: pos.x, y: pos.y });
  if (brushTrail.length > BRUSH_TRAIL_MAX) brushTrail.shift();
}

/**
 * Compute B and C positions for the current frame.
 * Call once per frame after pushHistory(posA).
 *
 * @param {number} W - canvas width
 * @param {number} H - canvas height
 * @param {object} params - { pointerLatency, pointerSmoothing, brushLatency, brushSmoothing }
 */
export function computeCurrentPositions(W, H, params) {
  const alphaB = emaAlpha(params.pointerSmoothing);
  const alphaC = emaAlpha(params.brushSmoothing);

  // B = EMA_b( A delayed by pointerLatency )
  const delayedA = getDelayedPos(params.pointerLatency, W, H);
  const posB = emaStep(emaB, delayedA, alphaB);

  // C = EMA_c( B delayed by brushLatency )
  pushBHistory(posB);
  const delayedB = getBDelayedPos(params.brushLatency, W, H);
  const posC = emaStep(emaC, delayedB, alphaC);

  return { posB: { x: posB.x, y: posB.y }, posC: { x: posC.x, y: posC.y } };
}

/**
 * Pre-warm: run the simulation for HISTORY_SIZE frames so trails/history are populated.
 *
 * @param {number} W - canvas width
 * @param {number} H - canvas height
 * @param {object} params - { pointerLatency, pointerSmoothing, brushLatency, brushSmoothing, penSpeed }
 */
export function preWarm(W, H, params) {
  let t = 0;
  for (let i = 0; i < HISTORY_SIZE; i++) {
    t += params.penSpeed * TIME_STEP_SCALE;
    const posA = autoPosition(t, W, H, params.pathType || 'lissajous');
    pushHistory(posA);
    const { posC } = computeCurrentPositions(W, H, params);
    pushBrushTrail(posC);
  }
  return t;
}
