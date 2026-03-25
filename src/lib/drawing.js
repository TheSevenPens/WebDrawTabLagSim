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

/**
 * Draw a dashed path through an array of points (following the actual trajectory).
 */
export function drawDashedPath(ctx, points) {
  if (!points || points.length < 2) return;
  ctx.save();
  ctx.strokeStyle = COLORS.dashedLine;
  ctx.lineWidth = 1.5;
  ctx.setLineDash([6, 5]);
  ctx.beginPath();
  ctx.moveTo(points[0].x, points[0].y);
  for (let i = 1; i < points.length; i++) {
    ctx.lineTo(points[i].x, points[i].y);
  }
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

/**
 * Compute Catmull-Rom control points for a cubic bezier between p1 and p2,
 * given neighboring points p0 and p3. Tension = 0.5 (standard Catmull-Rom).
 */
function catmullRomToBezier(p0, p1, p2, p3) {
  const t = 0.5;
  return {
    cp1x: p1.x + (p2.x - p0.x) / (6 / t),
    cp1y: p1.y + (p2.y - p0.y) / (6 / t),
    cp2x: p2.x - (p3.x - p1.x) / (6 / t),
    cp2y: p2.y - (p3.y - p1.y) / (6 / t),
  };
}

/**
 * Evaluate a cubic bezier at parameter s (0–1).
 */
function evalBezier(p0x, p0y, cp1x, cp1y, cp2x, cp2y, p1x, p1y, s) {
  const inv = 1 - s;
  const inv2 = inv * inv;
  const inv3 = inv2 * inv;
  const s2 = s * s;
  const s3 = s2 * s;
  return {
    x: inv3 * p0x + 3 * inv2 * s * cp1x + 3 * inv * s2 * cp2x + s3 * p1x,
    y: inv3 * p0y + 3 * inv2 * s * cp1y + 3 * inv * s2 * cp2y + s3 * p1y,
  };
}

// Number of subdivisions per segment when smooth stroke is enabled
const SUBDIVISIONS = 16;

export function drawBrushStroke(ctx, trail, brushSize = 10, smoothStroke = false) {
  if (trail.length < 3) return;
  const scale = brushSize / 10; // UI range 1–30, normalized so 10 = default
  const [r, g, b] = COLORS.brushStroke;
  const [hr, hg, hb] = COLORS.brushHighlight;
  ctx.save();
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  if (smoothStroke && trail.length >= 4) {
    // Subdivided Catmull-Rom: smooth path AND smooth width transitions
    for (let i = 1; i < trail.length; i++) {
      const p0 = trail[Math.max(0, i - 2)];
      const p1 = trail[i - 1];
      const p2 = trail[i];
      const p3 = trail[Math.min(trail.length - 1, i + 1)];
      const { cp1x, cp1y, cp2x, cp2y } = catmullRomToBezier(p0, p1, p2, p3);

      // t values at segment start and end (for width/alpha interpolation)
      const t0 = (i - 1) / trail.length;
      const t1 = i / trail.length;

      let prevPt = { x: p1.x, y: p1.y };

      for (let sub = 1; sub <= SUBDIVISIONS; sub++) {
        const s = sub / SUBDIVISIONS;
        const pt = evalBezier(p1.x, p1.y, cp1x, cp1y, cp2x, cp2y, p2.x, p2.y, s);

        // Interpolate t across the subdivision for smooth width/alpha
        const t = t0 + (t1 - t0) * s;
        const alpha = 0.08 + t * 0.55;
        const width = (1 + t * t * 35) * scale;

        ctx.strokeStyle = `rgba(${r}, ${g}, ${b}, ${alpha})`;
        ctx.lineWidth = width;
        ctx.beginPath();
        ctx.moveTo(prevPt.x, prevPt.y);
        ctx.lineTo(pt.x, pt.y);
        ctx.stroke();

        prevPt = pt;
      }
    }

    // Highlight pass — subdivided
    const halfLen = Math.floor(trail.length * 0.5);
    for (let i = Math.max(1, halfLen); i < trail.length; i++) {
      const p0 = trail[Math.max(0, i - 2)];
      const p1 = trail[i - 1];
      const p2 = trail[i];
      const p3 = trail[Math.min(trail.length - 1, i + 1)];
      const { cp1x, cp1y, cp2x, cp2y } = catmullRomToBezier(p0, p1, p2, p3);

      const t0 = (i - 1) / trail.length;
      const t1 = i / trail.length;

      let prevPt = { x: p1.x, y: p1.y };

      for (let sub = 1; sub <= SUBDIVISIONS; sub++) {
        const s = sub / SUBDIVISIONS;
        const pt = evalBezier(p1.x, p1.y, cp1x, cp1y, cp2x, cp2y, p2.x, p2.y, s);

        const t = t0 + (t1 - t0) * s;
        const w = t * t * 20 * scale;

        ctx.strokeStyle = `rgba(${hr}, ${hg}, ${hb}, ${t * 0.15})`;
        ctx.lineWidth = w;
        ctx.beginPath();
        ctx.moveTo(prevPt.x, prevPt.y - w * 0.15);
        ctx.lineTo(pt.x, pt.y - w * 0.15);
        ctx.stroke();

        prevPt = pt;
      }
    }
  } else {
    // Original: straight lines, one per segment
    for (let i = 1; i < trail.length; i++) {
      const t = i / trail.length;
      ctx.strokeStyle = `rgba(${r}, ${g}, ${b}, ${0.08 + t * 0.55})`;
      ctx.lineWidth = (1 + t * t * 35) * scale;
      ctx.beginPath();
      ctx.moveTo(trail[i - 1].x, trail[i - 1].y);
      ctx.lineTo(trail[i].x, trail[i].y);
      ctx.stroke();
    }

    const halfLen = Math.floor(trail.length * 0.5);
    for (let i = halfLen; i < trail.length; i++) {
      const t = i / trail.length;
      const w = t * t * 20 * scale;
      ctx.strokeStyle = `rgba(${hr}, ${hg}, ${hb}, ${t * 0.15})`;
      ctx.lineWidth = w;
      ctx.beginPath();
      ctx.moveTo(trail[i - 1].x, trail[i - 1].y - w * 0.15);
      ctx.lineTo(trail[i].x, trail[i].y - w * 0.15);
      ctx.stroke();
    }
  }

  ctx.restore();
}

/**
 * Draw a pre-computed track (closed loop) as a thin line.
 */
export function drawTrack(ctx, points, color) {
  if (!points || points.length < 2) return;
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(points[0].x, points[0].y);
  for (let i = 1; i < points.length; i++) {
    ctx.lineTo(points[i].x, points[i].y);
  }
  ctx.closePath();
  ctx.stroke();
  ctx.restore();
}

const CIRCLE_COLOR_MAP = { a: 'circleA', b: 'circleB', c: 'circleC' };

export function drawPosition(ctx, pos, key, showCircle, showLabel) {
  const offset = LABEL_OFFSETS[key];
  const radius = CIRCLE_RADII[key];
  if (showCircle) drawDashedCircle(ctx, pos.x, pos.y, radius, COLORS[CIRCLE_COLOR_MAP[key]]);
  if (showLabel) drawLabel(ctx, key, pos.x + offset.dx, pos.y + offset.dy, offset.size);
}
