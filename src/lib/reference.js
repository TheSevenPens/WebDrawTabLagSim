/**
 * reference.js
 *
 * Reference tracks: the closed trajectories A, B and C trace in steady state,
 * drawn as guides behind the live simulation.
 *
 * They are produced by running an isolated simulation instance, the same
 * engine and the same tick model that drives the live view, so they include
 * report-rate holding, latency and smoothing exactly as the live positions do.
 * The instance is warmed up until its transients decay, then one full period
 * of the path is recorded tick by tick.
 *
 * Because the engine is deterministic, the recording is the live trajectory
 * one period (plus warm-up) after a restart. Tablet report phase relative to
 * the path period is not controlled, so at low report rates the exact held
 * points can differ slightly from what is live at a given moment; the shape
 * and extent are the same.
 */

import { createSimulation } from './simulation.js';
import { periodTicks } from './animation.js';
import { TICKS_PER_SECOND } from './constants.js';

// Minimum ticks to run before recording
const MIN_WARMUP_TICKS = 1500;

// A first-order filter leaves e^-k of its initial offset after k time
// constants; k = 10 is ~5e-5, well under a pixel on any canvas here.
const CONVERGENCE_TIME_CONSTANTS = 10;

// Upper bound so extreme settings can't make recomputing a track slow
const MAX_WARMUP_TICKS = 250000;

const finiteOr = (v, fallback) => (Number.isFinite(v) ? v : fallback);

/**
 * Ticks needed for both filter stages to settle.
 *
 * Pointer smoothing advances once per tablet *report*, so its time constant
 * is (1 + smoothing) reports = (1 + smoothing) * TICKS_PER_SECOND / reportRate
 * ticks, which is long at low report rates. Brush smoothing advances every
 * tick. The two are cascaded, so summing their time constants is a safe bound.
 * Latency delays are added on top.
 */
export function warmupTicks(params, steps) {
  const reportRate = finiteOr(params.reportRate, TICKS_PER_SECOND);
  const ticksPerReport = TICKS_PER_SECOND / (reportRate > 0 ? reportRate : TICKS_PER_SECOND);
  const tauPointer = (1 + Math.max(0, finiteOr(params.pointerSmoothing, 0))) * ticksPerReport;
  const tauBrush = 1 + Math.max(0, finiteOr(params.brushSmoothing, 0));
  const delays = Math.max(0, finiteOr(params.pointerLatency, 0)) + Math.max(0, finiteOr(params.brushLatency, 0));

  const settle = Math.ceil(CONVERGENCE_TIME_CONSTANTS * (tauPointer + tauBrush) + delays);
  return Math.min(MAX_WARMUP_TICKS, Math.max(steps, MIN_WARMUP_TICKS, settle));
}

/**
 * @param {number} W - canvas width
 * @param {number} H - canvas height
 * @param {import('./types.js').ReferenceParams} params - { penSpeed, pathType, pointerLatency,
 *   pointerSmoothing, brushLatency, brushSmoothing, reportRate }
 * @returns {import('./types.js').ReferenceTracks} one period each
 */
export function computeReferenceTracks(W, H, params) {
  const steps = periodTicks(params.penSpeed, params.pathType);
  // The trail isn't used here; keep it tiny
  const p = { ...params, brushSpacing: 0, brushTrailLength: 1 };
  const sim = createSimulation();

  const warmup = warmupTicks(params, steps);
  for (let i = 0; i < warmup; i++) sim.step(W, H, p);

  const trackA = [];
  const trackB = [];
  const trackC = [];
  for (let i = 0; i < steps; i++) {
    const { posA, posB, posC } = sim.step(W, H, p);
    trackA.push(posA);
    trackB.push(posB);
    trackC.push(posC);
  }
  return { trackA, trackB, trackC };
}
