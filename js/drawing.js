import { FONT, COLORS, LABEL_OFFSETS, CIRCLE_RADII } from './constants.js';

export function drawDashedCircle(ctx, x, y, r, color) {
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = 2;
  ctx.setLineDash([5, 4]);
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.restore();
}

export function drawDashedLine(ctx, x1, y1, x2, y2) {
  ctx.save();
  ctx.strokeStyle = COLORS.dashedLine;
  ctx.lineWidth = 1.5;
  ctx.setLineDash([6, 5]);
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.restore();
}

export function drawLabel(ctx, text, x, y, fontSize) {
  ctx.save();
  ctx.font = `bold italic ${fontSize}px ${FONT}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = COLORS.label;
  ctx.fillText(text, x, y);
  ctx.restore();
}

export function drawPen(ctx, x, y) {
  const H = 55, W = 12;
  ctx.save();
  ctx.shadowColor = 'rgba(0,0,0,0.2)';
  ctx.shadowBlur = 6;
  ctx.shadowOffsetX = 2;
  ctx.shadowOffsetY = 2;
  const grad = ctx.createLinearGradient(x - W / 2, y - H, x + W / 2, y);
  grad.addColorStop(0, COLORS.penBody[0]);
  grad.addColorStop(0.7, COLORS.penBody[1]);
  grad.addColorStop(1, COLORS.penBody[2]);
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.moveTo(x - W / 2, y - H);
  ctx.lineTo(x + W / 2, y - H);
  ctx.lineTo(x + 3, y - 5);
  ctx.lineTo(x - 3, y - 5);
  ctx.closePath();
  ctx.fill();
  ctx.shadowColor = 'transparent';
  ctx.fillStyle = COLORS.penTip;
  ctx.beginPath();
  ctx.moveTo(x - 3, y - 5);
  ctx.lineTo(x + 3, y - 5);
  ctx.lineTo(x, y + 3);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

export function drawPointer(ctx, x, y) {
  ctx.save();
  const s = 1.4;
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.lineTo(x, y + 20 * s);
  ctx.lineTo(x + 5 * s, y + 15 * s);
  ctx.lineTo(x + 8 * s, y + 22 * s);
  ctx.lineTo(x + 11 * s, y + 20 * s);
  ctx.lineTo(x + 8 * s, y + 13 * s);
  ctx.lineTo(x + 13 * s, y + 13 * s);
  ctx.closePath();
  ctx.fillStyle = '#ffffff';
  ctx.fill();
  ctx.strokeStyle = '#222222';
  ctx.lineWidth = 1.5;
  ctx.stroke();
  ctx.restore();
}

export function drawCrosshair(ctx, x, y) {
  const size = 14;
  const gap = 4;
  const segments = [
    [x - size, y, x - gap, y],
    [x + gap, y, x + size, y],
    [x, y - size, x, y - gap],
    [x, y + gap, x, y + size],
  ];
  ctx.save();
  ctx.lineCap = 'round';
  ctx.strokeStyle = '#222222';
  ctx.lineWidth = 4;
  segments.forEach(([x1, y1, x2, y2]) => {
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();
  });
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 2;
  segments.forEach(([x1, y1, x2, y2]) => {
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();
  });
  ctx.fillStyle = '#ffffff';
  ctx.strokeStyle = '#222222';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.arc(x, y, 2, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.restore();
}

export function drawBrushStroke(ctx, trail) {
  if (trail.length < 3) return;
  const [r, g, b] = COLORS.brushStroke;
  const [hr, hg, hb] = COLORS.brushHighlight;
  ctx.save();
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  for (let i = 1; i < trail.length; i++) {
    const t = i / trail.length;
    ctx.strokeStyle = `rgba(${r}, ${g}, ${b}, ${0.08 + t * 0.55})`;
    ctx.lineWidth = 1 + t * t * 35;
    ctx.beginPath();
    ctx.moveTo(trail[i - 1].x, trail[i - 1].y);
    ctx.lineTo(trail[i].x, trail[i].y);
    ctx.stroke();
  }
  const halfLen = Math.floor(trail.length * 0.5);
  for (let i = halfLen; i < trail.length; i++) {
    const t = i / trail.length;
    const w = t * t * 20;
    ctx.strokeStyle = `rgba(${hr}, ${hg}, ${hb}, ${t * 0.15})`;
    ctx.lineWidth = w;
    ctx.beginPath();
    ctx.moveTo(trail[i - 1].x, trail[i - 1].y - w * 0.15);
    ctx.lineTo(trail[i].x, trail[i].y - w * 0.15);
    ctx.stroke();
  }
  ctx.restore();
}

export function drawPosition(ctx, pos, key, showCircle, showLabel) {
  const offset = LABEL_OFFSETS[key];
  const radius = CIRCLE_RADII[key];
  if (showCircle) drawDashedCircle(ctx, pos.x, pos.y, radius, COLORS.circle);
  if (showLabel) drawLabel(ctx, key, pos.x + offset.dx, pos.y + offset.dy, offset.size);
}
