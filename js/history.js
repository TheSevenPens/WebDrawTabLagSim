import { HISTORY_SIZE, BRUSH_TRAIL_MAX } from './constants.js';

export const posHistory = [];
export const brushTrail = [];

export function getLaggedPos(lagFrames, canvasWidth, canvasHeight) {
  const idx = Math.max(0, posHistory.length - 1 - Math.round(lagFrames));
  return posHistory[idx] || posHistory[posHistory.length - 1] || { x: canvasWidth / 2, y: canvasHeight / 2 };
}

/**
 * Returns the slice of history points between two lag offsets.
 * startLag is the smaller lag (closer to present, e.g. 0 for point A),
 * endLag is the larger lag (further in the past, e.g. pointerLag for point B).
 * The returned array goes from the more-recent point to the older point.
 */
export function getPathSegment(startLag, endLag) {
  const len = posHistory.length;
  if (len === 0) return [];
  const idxStart = Math.max(0, Math.min(len - 1, len - 1 - Math.round(startLag)));
  const idxEnd = Math.max(0, Math.min(len - 1, len - 1 - Math.round(endLag)));
  const lo = Math.min(idxStart, idxEnd);
  const hi = Math.max(idxStart, idxEnd);
  // Return from recent (A) to older (B), so from hi down to lo
  const segment = [];
  for (let i = hi; i >= lo; i--) {
    segment.push(posHistory[i]);
  }
  return segment;
}

export function pushHistory(pos) {
  posHistory.push({ x: pos.x, y: pos.y });
  if (posHistory.length > HISTORY_SIZE) posHistory.shift();
}

export function pushBrushTrail(pos) {
  brushTrail.push({ x: pos.x, y: pos.y });
  if (brushTrail.length > BRUSH_TRAIL_MAX) brushTrail.shift();
}
