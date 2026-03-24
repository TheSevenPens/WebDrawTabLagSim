export function autoPosition(t, canvasWidth, canvasHeight) {
  const cx = canvasWidth * 0.5;
  const cy = canvasHeight * 0.5;
  return {
    x: cx + canvasWidth * 0.35 * Math.sin(t * 1.1),
    y: cy + canvasHeight * 0.3 * Math.sin(t * 1.9),
  };
}
