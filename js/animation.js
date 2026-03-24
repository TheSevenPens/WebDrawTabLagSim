import { TIME_STEP_SCALE } from './constants.js';

// Lissajous frequency ratio — simpler ratio = fewer loops
const FREQ_X = 2;
const FREQ_Y = 3;
const PERIOD = 2 * Math.PI;

export function autoPosition(t, canvasWidth, canvasHeight) {
  const cx = canvasWidth * 0.5;
  const cy = canvasHeight * 0.5;
  return {
    x: cx + canvasWidth * 0.35 * Math.sin(t * FREQ_X),
    y: cy + canvasHeight * 0.3 * Math.sin(t * FREQ_Y),
  };
}

/**
 * Compute how many simulation steps make up one full period at the given pen speed.
 * This must match the runtime: each frame advances time by penSpeed * TIME_STEP_SCALE.
 */
function stepsPerPeriod(penSpeed) {
  return Math.round(PERIOD / (penSpeed * TIME_STEP_SCALE));
}

/**
 * Pre-compute A's track as a closed loop, sampled at the same rate as runtime.
 */
export function computeTrackA(canvasWidth, canvasHeight, penSpeed) {
  const steps = stepsPerPeriod(penSpeed);
  const dt = penSpeed * TIME_STEP_SCALE;
  const points = [];
  for (let i = 0; i < steps; i++) {
    points.push(autoPosition(i * dt, canvasWidth, canvasHeight));
  }
  return points;
}

/**
 * Compute the steady-state track for B (or C) by running the full
 * delay + EMA pipeline over multiple periods and returning the last period.
 *
 * Because we use the same step count and dt as runtime, the EMA and latency
 * behave identically to the live simulation.
 *
 * @param {Array} inputTrack - One period of source positions (A's track for B, B's track for C)
 * @param {number} latency - Delay in frames (same units as runtime)
 * @param {number} smoothing - EMA smoothing parameter (0 = passthrough)
 * @param {number} warmupPeriods - Extra periods to reach EMA steady state
 * @returns {Array} One period of steady-state positions
 */
export function computeSmoothedTrack(inputTrack, latency, smoothing, warmupPeriods = 5) {
  const steps = inputTrack.length;
  if (steps === 0) return [];

  const alpha = 1 / (1 + smoothing);
  const delaySteps = Math.round(latency);
  const totalSteps = steps * (warmupPeriods + 1);

  const ema = { x: null, y: null };
  const lastPeriod = [];

  for (let i = 0; i < totalSteps; i++) {
    // Delayed read from the periodic input
    const delayedIdx = i - delaySteps;
    const input = delayedIdx >= 0
      ? inputTrack[delayedIdx % steps]
      : inputTrack[((delayedIdx % steps) + steps) % steps];

    // EMA step
    if (ema.x === null) {
      ema.x = input.x;
      ema.y = input.y;
    } else {
      ema.x = alpha * input.x + (1 - alpha) * ema.x;
      ema.y = alpha * input.y + (1 - alpha) * ema.y;
    }

    // Collect the last period
    if (i >= totalSteps - steps) {
      lastPeriod.push({ x: ema.x, y: ema.y });
    }
  }

  return lastPeriod;
}
