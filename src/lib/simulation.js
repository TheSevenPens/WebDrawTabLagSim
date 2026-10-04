/**
 * simulation.js
 *
 * Models the lag pipeline: A (pen tip) → B (OS pointer) → C (brush stroke).
 *
 * Each stage has two parameters:
 *   - latency: pure time delay in ticks (B sees A's position from N ticks ago)
 *   - smoothing: EMA filter strength (0 = passthrough, higher = more smoothing)
 *
 * B also has a report rate: the tablet only sends position updates at a fixed
 * frequency. Between reports, B holds its last position. One tick is
 * 1/TICKS_PER_SECOND s of simulated time, so reportRate=60 reports every tick
 * and reportRate=45 reports on 3 of every 4 ticks. Report timing uses a
 * fractional accumulator, so any rate is exact over time.
 *
 * The EMA formula:  output = alpha * input + (1 - alpha) * prev_output
 * where alpha = 1 / (1 + smoothing).   smoothing=0 → alpha=1 → no filtering.
 *
 * A simulation is an instance (createSimulation) that owns all of its state
 * and knows nothing about the DOM, the host frame rate or storage. Callers
 * decide when to step it; see clock.js. Two instances never affect each other.
 */

import { HISTORY_SIZE, BRUSH_TRAIL_MAX, TIME_STEP_SCALE, TICKS_PER_SECOND } from './constants.js';
import { autoPosition, safePenSpeed } from './animation.js';

const REPORT_EPSILON = 1e-9;

/**
 * Compute EMA alpha from the smoothing slider value.
 * smoothing=0 → alpha=1 (passthrough), smoothing=100 → alpha≈0.01 (heavy filter).
 */
function emaAlpha(smoothing) {
  // Negative/non-finite smoothing would give alpha > 1 (unstable) or NaN
  const s = Number.isFinite(smoothing) ? Math.max(0, smoothing) : 0;
  return 1 / (1 + s);
}

/** Latency in whole ticks, never negative. */
function latencyTicks(latency) {
  return Number.isFinite(latency) ? Math.max(0, Math.round(latency)) : 0;
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

function pushCapped(buffer, pos) {
  buffer.push({ x: pos.x, y: pos.y });
  if (buffer.length > HISTORY_SIZE) buffer.shift();
}

function delayed(buffer, ticks, fallback) {
  const idx = Math.max(0, buffer.length - 1 - latencyTicks(ticks));
  return buffer[idx] || fallback;
}

/**
 * Create an independent simulation instance.
 *
 * @returns {import('./types.js').Simulation}
 *   `brushTrail` and `current` ({ posA, posB, posC }) are live views of this
 *   instance's state. Treat them as read-only.
 */
export function createSimulation() {
  const posHistory = [];
  const posBHistory = [];
  const brushTrail = [];
  const emaB = { x: null, y: null };
  const emaC = { x: null, y: null };

  let time = 0;
  let reportAccum = null;
  let lastReportedB = null;
  let reportCount = 0;

  /** @type {import('./types.js').Simulation} */
  const sim = {
    brushTrail,
    current: null,
    get time() { return time; },
    get reportCount() { return reportCount; },

    /** Clear all state. */
    reset() {
      posHistory.length = 0;
      posBHistory.length = 0;
      brushTrail.length = 0;
      emaB.x = emaB.y = null;
      emaC.x = emaC.y = null;
      time = 0;
      reportAccum = null;
      lastReportedB = null;
      reportCount = 0;
      sim.current = null;
    },

    /**
     * Advance one tick.
     *
     * @param {number} W - canvas width
     * @param {number} H - canvas height
     * @param {import('./types.js').SimParams} params - { pointerLatency, pointerSmoothing, brushLatency, brushSmoothing,
     *   penSpeed, pathType, reportRate, brushSpacing, brushTrailLength }
     * @param {{ penMoving?: boolean }} [opts] - `penMoving` (default true): false holds the
     *   pen still while the filters keep running (so B and C converge onto A)
     * @returns {import('./types.js').SimSnapshot}
     */
    step(W, H, params, { penMoving = true } = {}) {
      // --- A: pen tip ---
      if (penMoving) time += safePenSpeed(params.penSpeed) * TIME_STEP_SCALE;
      const posA = autoPosition(time, W, H, params.pathType || 'lissajous');
      pushCapped(posHistory, posA);

      // --- B: report gate → latency → EMA ---
      const reportRate = Number.isFinite(params.reportRate) && params.reportRate > 0
        ? params.reportRate : TICKS_PER_SECOND;
      const perTick = reportRate / TICKS_PER_SECOND;
      // Start so the very first tick reports, then every 1/perTick ticks on average
      if (reportAccum === null) reportAccum = 1 - perTick;
      reportAccum += perTick;

      let posB;
      if (reportAccum >= 1 - REPORT_EPSILON || lastReportedB === null) {
        reportAccum = Math.max(0, reportAccum - 1);
        reportCount++;
        const delayedA = delayed(posHistory, params.pointerLatency, { x: W / 2, y: H / 2 });
        posB = emaStep(emaB, delayedA, emaAlpha(params.pointerSmoothing));
        lastReportedB = { x: posB.x, y: posB.y };
      } else {
        // Between reports: hold the last position (don't run EMA)
        posB = { x: lastReportedB.x, y: lastReportedB.y };
      }

      // --- C: B delayed by brush latency → EMA ---
      pushCapped(posBHistory, posB);
      const delayedB = delayed(posBHistory, params.brushLatency, { x: W / 2, y: H / 2 });
      const posC = emaStep(emaC, delayedB, emaAlpha(params.brushSmoothing));

      sim.pushBrushTrail(posC, params.brushSpacing, params.brushTrailLength);
      sim.current = { posA, posB, posC };
      return sim.current;
    },

    /**
     * Push a C position into the brush trail ring buffer.
     * When brushSpacing > 0, only adds a point if C has moved at least that many
     * pixels from the last recorded point. brushSpacing = 0 means continuous.
     * Capacity is enforced first, so it holds even when spacing skips the point.
     */
    pushBrushTrail(pos, brushSpacing = 0, maxTrailLength = BRUSH_TRAIL_MAX) {
      const cap = Math.max(1, Math.floor(maxTrailLength) || 1);
      if (brushTrail.length > cap) brushTrail.splice(0, brushTrail.length - cap);

      if (brushSpacing > 0 && brushTrail.length > 0) {
        const last = brushTrail[brushTrail.length - 1];
        const dx = pos.x - last.x;
        const dy = pos.y - last.y;
        if (dx * dx + dy * dy < brushSpacing * brushSpacing) return;
      }
      brushTrail.push({ x: pos.x, y: pos.y });
      if (brushTrail.length > cap) brushTrail.shift();
    },

    /**
     * Pre-warm: reset, then run HISTORY_SIZE ticks so histories and trail are populated.
     * @returns {import('./types.js').SimSnapshot} final positions
     */
    warmUp(W, H, params) {
      sim.reset();
      for (let i = 0; i < HISTORY_SIZE; i++) sim.step(W, H, params);
      return /** @type {import('./types.js').SimSnapshot} */ (sim.current);
    },
  };

  return sim;
}
