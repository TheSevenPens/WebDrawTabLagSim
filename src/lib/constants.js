export const FONT = '"Google Sans Flex", sans-serif';

export const COLORS = {
  background: '#c8cdd3',
  circleA: '#1480e0',
  circleB: '#d04040',
  circleC: '#2e8b57',
  label: '#222',
  legend: '#444',
  dashedLine: '#887860',
  penBody: ['#1480e0', '#1a6fc4', '#0e5090'],
  penTip: '#0e5090',
  brushStroke: [60, 140, 130],
  brushHighlight: [110, 190, 180],
};

export const HISTORY_SIZE = 400;
export const BRUSH_TRAIL_MAX = 180;
export const TIME_STEP_SCALE = 0.001;

// Simulation clock: the pipeline advances in fixed ticks of simulated time,
// independent of the host display's frame rate. Latency settings are in ticks.
export const TICKS_PER_SECOND = 60;
export const TICK_MS = 1000 / TICKS_PER_SECOND;

export const LABEL_OFFSETS = {
  a: { dx: -22, dy: 24, size: 22 },
  b: { dx: 0, dy: 34, size: 22 },
  c: { dx: 20, dy: 26, size: 24 },
};

export const CIRCLE_RADII = { a: 16, b: 20, c: 24 };
