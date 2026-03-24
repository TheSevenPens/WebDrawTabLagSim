export const state = {
  // Pointer (b) controls
  pointerLatency: 25,   // frames of pure time delay
  pointerSmoothing: 0,  // EMA alpha: 0 = no smoothing, higher = more smoothing
  // Brush (c) controls
  brushLatency: 35,     // frames of pure time delay
  brushSmoothing: 0,    // EMA alpha: 0 = no smoothing, higher = more smoothing

  penSpeed: 7,

  // Visibility toggles
  showLineAB: true,
  showLineBC: true,
  showA: true,
  showB: true,
  showC: true,
  showPointer: true,
  pointerStyle: 'mouse',
  showCircleA: true,
  showCircleB: true,
  showCircleC: true,
};
