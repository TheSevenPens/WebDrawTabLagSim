import { HISTORY_SIZE, BRUSH_TRAIL_MAX } from './constants.js';

export const posHistory = [];
export const brushTrail = [];

export function getLaggedPos(lagFrames, canvasWidth, canvasHeight) {
  const idx = Math.max(0, posHistory.length - 1 - Math.round(lagFrames));
  return posHistory[idx] || posHistory[posHistory.length - 1] || { x: canvasWidth / 2, y: canvasHeight / 2 };
}

export function pushHistory(pos) {
  posHistory.push({ x: pos.x, y: pos.y });
  if (posHistory.length > HISTORY_SIZE) posHistory.shift();
}

export function pushBrushTrail(pos) {
  brushTrail.push({ x: pos.x, y: pos.y });
  if (brushTrail.length > BRUSH_TRAIL_MAX) brushTrail.shift();
}
