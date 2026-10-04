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

// Ticks to run before recording, as a minimum. EMA time constants top out at
// ~50 ticks per stage (smoothing 50), so ~1500 ticks lets two cascaded
// stages decay to well under a pixel.
const MIN_WARMUP_TICKS = 1500;

/**
 * @param {number} W - canvas width
 * @param {number} H - canvas height
 * @param {object} params - { penSpeed, pathType, pointerLatency, pointerSmoothing,
 *   brushLatency, brushSmoothing, reportRate }
 * @returns {{ trackA: object[], trackB: object[], trackC: object[] }} one period each
 */
export function computeReferenceTracks(W, H, params) {
  const steps = periodTicks(params.penSpeed, params.pathType);
  // The trail isn't used here; keep it tiny
  const p = { ...params, brushSpacing: 0, brushTrailLength: 1 };
  const sim = createSimulation();

  const warmup = Math.max(steps, MIN_WARMUP_TICKS);
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
