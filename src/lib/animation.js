import { TIME_STEP_SCALE } from './constants.js';

// --- Path type: Lissajous ---
const FREQ_X = 2;
const FREQ_Y = 3;

function lissajousPosition(t, cx, cy, rx, ry) {
  return {
    x: cx + rx * Math.sin(t * FREQ_X),
    y: cy + ry * Math.sin(t * FREQ_Y),
  };
}

// --- Path type: Circle ---
// Speed factor to match perceived speed with Lissajous (which uses frequencies 2 & 3)
const CIRCLE_SPEED = 2.5;
function circlePosition(t, cx, cy, rx, ry) {
  return {
    x: cx + rx * Math.sin(t * CIRCLE_SPEED),
    y: cy + ry * Math.cos(t * CIRCLE_SPEED),
  };
}

// --- Path type: Star ---
// The pen moves directly between the 5 points of a star (pentagram order).
// We parameterize so that t goes 0→2π for one full traversal of all 5 edges.

const STAR_POINTS = 5;
// Pentagram vertex order: 0, 2, 4, 1, 3 (skip-one pattern)
const STAR_ORDER = [0, 2, 4, 1, 3];

function getStarVertices(cx, cy, rx, ry) {
  const vertices = [];
  for (let i = 0; i < STAR_POINTS; i++) {
    const angle = -Math.PI / 2 + (i * 2 * Math.PI) / STAR_POINTS;
    vertices.push({
      x: cx + rx * Math.cos(angle),
      y: cy + ry * Math.sin(angle),
    });
  }
  return vertices;
}

function starPosition(t, cx, cy, rx, ry) {
  const vertices = getStarVertices(cx, cy, rx, ry);
  // Normalize t to [0, 1) within one period
  const period = 2 * Math.PI;
  let frac = ((t % period) + period) % period / period;
  // Map fraction to edge index + interpolation
  const totalEdges = STAR_POINTS;
  const edgeFloat = frac * totalEdges;
  const edgeIdx = Math.floor(edgeFloat) % totalEdges;
  const edgeFrac = edgeFloat - Math.floor(edgeFloat);
  const from = vertices[STAR_ORDER[edgeIdx]];
  const to = vertices[STAR_ORDER[(edgeIdx + 1) % totalEdges]];
  return {
    x: from.x + (to.x - from.x) * edgeFrac,
    y: from.y + (to.y - from.y) * edgeFrac,
  };
}

// --- Public API ---

const PERIOD = 2 * Math.PI;

// Each path type's visual period (the parameter range for one complete loop)
function pathPeriod(pathType) {
  switch (pathType) {
    case 'circle': return PERIOD / CIRCLE_SPEED; // one full revolution
    case 'star':
    case 'lissajous':
    default:
      return PERIOD;
  }
}

export const PATH_TYPES = ['lissajous', 'circle', 'star'];

export function autoPosition(t, canvasWidth, canvasHeight, pathType = 'lissajous') {
  const cx = canvasWidth * 0.5;
  const cy = canvasHeight * 0.5;
  const rx = canvasWidth * 0.44;
  const ry = canvasHeight * 0.42;

  switch (pathType) {
    case 'circle':
      return circlePosition(t, cx, cy, rx, ry);
    case 'star':
      return starPosition(t, cx, cy, rx, ry);
    case 'lissajous':
    default:
      return lissajousPosition(t, cx, cy, rx, ry);
  }
}

/**
 * Compute how many simulation steps make up one full period at the given pen speed.
 */
function stepsPerPeriod(penSpeed, pathType = 'lissajous') {
  return Math.round(pathPeriod(pathType) / (penSpeed * TIME_STEP_SCALE));
}

/**
 * Pre-compute A's track as a closed loop, sampled at the same rate as runtime.
 */
export function computeTrackA(canvasWidth, canvasHeight, penSpeed, pathType = 'lissajous') {
  const steps = stepsPerPeriod(penSpeed, pathType);
  const dt = penSpeed * TIME_STEP_SCALE;
  const points = [];
  for (let i = 0; i < steps; i++) {
    points.push(autoPosition(i * dt, canvasWidth, canvasHeight, pathType));
  }
  return points;
}

/**
 * Compute the steady-state track for B (or C) by running the full
 * delay + EMA pipeline over multiple periods and returning the last period.
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
    const delayedIdx = i - delaySteps;
    const input = delayedIdx >= 0
      ? inputTrack[delayedIdx % steps]
      : inputTrack[((delayedIdx % steps) + steps) % steps];

    if (ema.x === null) {
      ema.x = input.x;
      ema.y = input.y;
    } else {
      ema.x = alpha * input.x + (1 - alpha) * ema.x;
      ema.y = alpha * input.y + (1 - alpha) * ema.y;
    }

    if (i >= totalSteps - steps) {
      lastPeriod.push({ x: ema.x, y: ema.y });
    }
  }

  return lastPeriod;
}
