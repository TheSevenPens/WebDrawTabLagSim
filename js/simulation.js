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
 * Forward-simulation: to draw connector lines along the *actual* future trajectory,
 * we peek ahead at A's deterministic path, clone the EMA state, and run the filter
 * forward to predict where B (and C) will be in the coming frames.
 */

import { HISTORY_SIZE, BRUSH_TRAIL_MAX, TIME_STEP_SCALE } from './constants.js';
import { autoPosition } from './animation.js';
import { state } from './state.js';

// --- Raw position history for A (pen tip) ---
export const posHistory = [];
export const brushTrail = [];

// --- EMA filter state for B and C ---
const emaB = { x: null, y: null };
const emaC = { x: null, y: null };

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
 */
export function computeCurrentPositions(W, H) {
  const alphaB = emaAlpha(state.pointerSmoothing);
  const alphaC = emaAlpha(state.brushSmoothing);

  // B = EMA_b( A delayed by pointerLatency )
  const delayedA = getDelayedPos(state.pointerLatency, W, H);
  const posB = emaStep(emaB, delayedA, alphaB);

  // C = EMA_c( B delayed by brushLatency )
  // We need B's history for the delay. Instead of maintaining a separate B history,
  // we compute C as: EMA_c applied to the position from A's history delayed by
  // (pointerLatency + brushLatency), then smoothed by both filters.
  // But that conflates the two stages. For accuracy, C should filter B's output.
  //
  // Simpler correct approach: C applies its own EMA to the delayed-B.
  // Since B is computed frame-by-frame, we store B's history too.
  pushBHistory(posB);
  const delayedB = getBDelayedPos(state.brushLatency, W, H);
  const posC = emaStep(emaC, delayedB, alphaC);

  return { posB: { x: posB.x, y: posB.y }, posC: { x: posC.x, y: posC.y } };
}

// --- B position history (needed so C can delay off B's output) ---
const posBHistory = [];

function pushBHistory(pos) {
  posBHistory.push({ x: pos.x, y: pos.y });
  if (posBHistory.length > HISTORY_SIZE) posBHistory.shift();
}

function getBDelayedPos(latencyFrames, W, H) {
  const idx = Math.max(0, posBHistory.length - 1 - Math.round(latencyFrames));
  return posBHistory[idx] || { x: W / 2, y: H / 2 };
}

/**
 * Forward-simulate B's future trajectory from its current state to A's current position.
 * Returns array of predicted positions (starting from current B, ending near current A).
 *
 * Steps = pointerLatency frames of look-ahead using A's deterministic future path.
 */
export function forwardSimulateAtoB(currentTime, W, H) {
  const steps = Math.max(1, Math.round(state.pointerLatency));
  if (steps === 0) return [];

  const alphaB = emaAlpha(state.pointerSmoothing);
  // Clone EMA state
  const simEma = { x: emaB.x, y: emaB.y };
  const path = [{ x: simEma.x, y: simEma.y }];

  for (let i = 1; i <= steps; i++) {
    // Future time step
    const futureTime = currentTime + i * state.penSpeed * TIME_STEP_SCALE;
    // At that future time, B will process A's position from (pointerLatency - i) frames ago
    // relative to that future frame.  Since A moves deterministically, we can compute
    // A's position at the future time minus the remaining delay.
    // Simpler: the input to B at future frame i is A's position at time
    // (currentTime + i * dt) - pointerLatency * dt ... but latency is in frames,
    // so the input is A's position from the history offset by (pointerLatency - i).
    // When i = pointerLatency, the input is A's current position (offset 0).
    const histOffset = Math.max(0, state.pointerLatency - i);
    const inputPos = getDelayedPos(histOffset, W, H);
    emaStep(simEma, inputPos, alphaB);
    path.push({ x: simEma.x, y: simEma.y });
  }

  return path;
}

/**
 * Forward-simulate C's future trajectory from its current state to B's current position.
 * Returns array of predicted positions.
 */
export function forwardSimulateBtoC(currentTime, W, H) {
  const steps = Math.max(1, Math.round(state.brushLatency));
  if (steps === 0) return [];

  const alphaC = emaAlpha(state.brushSmoothing);
  const simEma = { x: emaC.x, y: emaC.y };
  const path = [{ x: simEma.x, y: simEma.y }];

  for (let i = 1; i <= steps; i++) {
    const histOffset = Math.max(0, state.brushLatency - i);
    const inputPos = getBDelayedPos(histOffset, W, H);
    emaStep(simEma, inputPos, alphaC);
    path.push({ x: simEma.x, y: simEma.y });
  }

  return path;
}

/**
 * Pre-warm: run the simulation for HISTORY_SIZE frames so trails/history are populated.
 */
export function preWarm(W, H) {
  let t = 0;
  for (let i = 0; i < HISTORY_SIZE; i++) {
    t += state.penSpeed * TIME_STEP_SCALE;
    const posA = autoPosition(t, W, H);
    pushHistory(posA);
    const { posC } = computeCurrentPositions(W, H);
    pushBrushTrail(posC);
  }
  return t;
}
