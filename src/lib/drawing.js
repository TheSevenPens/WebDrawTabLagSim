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

// The pen outline, taken from the standing Wacom pen drawing (eraser end up, tip
// down). Only the right half is stored; each shape walks down that half and back up
// its mirror image about the center line, so the pen is symmetric by construction.
// Coordinates are the drawing's own units (its 4725 x 4725 viewBox).
const PEN_CENTER_X = 2338.333;
const PEN_TOP_Y = 211.483; // top of the eraser cap
const PEN_TIP_Y = 4566.1; // bottom of the nib: this is the point drawn at (x, y)
const PEN_HALF_WIDTH = 198; // widest point of the barrel, measured from the center line

// Rendered height of the pen in canvas pixels at scale 1 (the Medium size); the width
// follows from the drawing.
const PEN_HEIGHT = 120;

// Right-half segments. 'L' is a line to (x, y); 'C' is a cubic Bezier through
// control points (c1x, c1y), (c2x, c2y) to (x, y). Each shape starts on the center line.
const PEN_CAP = {
  start: [PEN_CENTER_X, PEN_TOP_Y],
  segments: [
    ['C', 2369.487, 211.483, 2396.639, 212.755, 2410.262, 235.863],
    ['C', 2421.521, 254.961, 2426.781, 344.92, 2428.795, 391.864],
    ['L', PEN_CENTER_X, 391.864],
  ],
};
const PEN_BARREL = {
  start: [PEN_CENTER_X, 391.864],
  segments: [
    ['L', 2452.807, 391.864],
    ['L', 2489.204, 2019.789],
    ['C', 2489.204, 2019.789, 2501.978, 3361.186, 2511.924, 3856.933],
    ['C', 2514.076, 3964.223, 2536.04, 3985.115, 2536.306, 4037.548],
    ['C', 2536.437, 4063.374, 2469.928, 4254.56, 2469.928, 4254.56],
    ['L', 2381.038, 4521.634],
    ['L', PEN_CENTER_X, 4521.634],
  ],
};
const PEN_NIB = {
  start: [PEN_CENTER_X, 4521.634],
  segments: [
    ['L', 2352.926, 4521.634],
    ['L', 2352.926, 4552.979],
    ['C', 2352.926, 4556.459, 2351.544, 4559.796, 2349.083, 4562.257],
    ['C', 2346.622, 4564.718, 2343.285, 4566.1, 2339.805, 4566.1],
    ['L', PEN_CENTER_X, 4566.1],
  ],
};

/**
 * Build the closed outline of a shape: down its right-hand segments, then back up
 * the same segments mirrored about the center line.
 */
function buildPenShape({ start, segments }) {
  const mirror = (px) => 2 * PEN_CENTER_X - px;
  const path = new Path2D();
  path.moveTo(start[0], start[1]);

  const nodes = [start];
  for (const [kind, ...v] of segments) {
    if (kind === 'L') path.lineTo(v[0], v[1]);
    else path.bezierCurveTo(v[0], v[1], v[2], v[3], v[4], v[5]);
    nodes.push(v.slice(-2));
  }

  for (let i = segments.length - 1; i >= 0; i--) {
    const [kind, ...v] = segments[i];
    const [px, py] = nodes[i];
    if (kind === 'L') path.lineTo(mirror(px), py);
    // Walking a curve backward swaps its two control points
    else path.bezierCurveTo(mirror(v[2]), v[3], mirror(v[0]), v[1], mirror(px), py);
  }
  path.closePath();
  return path;
}

// Path2D does not exist where the unit tests run, and the shapes are only needed
// once a pen is drawn, so they are built on first use.
let penShapes = null;
function getPenShapes() {
  penShapes ??= {
    cap: buildPenShape(PEN_CAP),
    barrel: buildPenShape(PEN_BARREL),
    nib: buildPenShape(PEN_NIB),
  };
  return penShapes;
}

/** Draw the pen standing upright with its tip at (x, y), `size` times its Medium size. */
export function drawPen(ctx, x, y, size = 1) {
  const { cap, barrel, nib } = getPenShapes();
  const scale = (PEN_HEIGHT * size) / (PEN_TIP_Y - PEN_TOP_Y);

  ctx.save();
  ctx.translate(x, y);
  ctx.scale(scale, scale);
  ctx.translate(-PEN_CENTER_X, -PEN_TIP_Y);
  ctx.lineJoin = 'round';
  ctx.lineWidth = 1 / scale; // a 1px outline whatever the pen's size
  ctx.strokeStyle = COLORS.penTip;

  // The shadow is in canvas pixels, so it is unaffected by the scale above
  ctx.shadowColor = 'rgba(0,0,0,0.2)';
  ctx.shadowBlur = 6;
  ctx.shadowOffsetX = 2;
  ctx.shadowOffsetY = 2;

  // Across the barrel: a highlight toward the left, shading toward the right
  const grad = ctx.createLinearGradient(PEN_CENTER_X - PEN_HALF_WIDTH, 0, PEN_CENTER_X + PEN_HALF_WIDTH, 0);
  grad.addColorStop(0, COLORS.penBody[2]);
  grad.addColorStop(0.3, COLORS.penBody[0]);
  grad.addColorStop(0.75, COLORS.penBody[1]);
  grad.addColorStop(1, COLORS.penBody[2]);
  ctx.fillStyle = grad;
  ctx.fill(barrel);
  ctx.stroke(barrel);

  ctx.fillStyle = COLORS.penBody[1];
  ctx.fill(cap);
  ctx.stroke(cap);

  ctx.shadowColor = 'transparent';
  ctx.fillStyle = COLORS.penTip;
  ctx.fill(nib);
  ctx.stroke(nib);
  ctx.restore();
}

export function drawPointer(ctx, x, y, scale = 1) {
  ctx.save();
  const s = 1.4 * scale;
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
  ctx.lineWidth = 1.5 * scale;
  ctx.stroke();
  ctx.restore();
}

export function drawCrosshair(ctx, x, y, scale = 1) {
  const size = 14 * scale;
  const gap = 4 * scale;
  const segments = [
    [x - size, y, x - gap, y],
    [x + gap, y, x + size, y],
    [x, y - size, x, y - gap],
    [x, y + gap, x, y + size],
  ];
  ctx.save();
  ctx.lineCap = 'round';
  ctx.strokeStyle = '#222222';
  ctx.lineWidth = 4 * scale;
  segments.forEach(([x1, y1, x2, y2]) => {
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();
  });
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 2 * scale;
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
export function catmullRomToBezier(p0, p1, p2, p3) {
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
export function evalBezier(p0x, p0y, cp1x, cp1y, cp2x, cp2y, p1x, p1y, s) {
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

// Most pieces one trail segment is split into when smooth stroke is enabled
const SUBDIVISIONS = 16;

// Each piece is a separate stroke() call, and a fixed 16 pieces per trail segment
// drew thousands of sub-pixel strokes per frame. A segment needs only as many
// pieces as its curve and its paint demand:
const GEOMETRY_TOLERANCE = 0.25; // max distance from the 16-piece curve, px
const WIDTH_TOLERANCE = 0.5; // max change in line width within one piece, px
const ALPHA_TOLERANCE = 0.03; // max change in opacity within one piece

function distanceToChordSquared(p, a, b) {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len2 = dx * dx + dy * dy;
  const t = len2 === 0 ? 0 : Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / len2));
  const ex = p.x - (a.x + t * dx);
  const ey = p.y - (a.y + t * dy);
  return ex * ex + ey * ey;
}

/**
 * Whether `pieces` uniform pieces (a divisor of the fine curve's 16) stay within
 * `tolerance` of the fine curve's points.
 */
function polylineWithin(fine, pieces, tolerance) {
  const step = SUBDIVISIONS / pieces;
  const limit = tolerance * tolerance;
  for (let j = 0; j < pieces; j++) {
    const a = fine[j * step];
    const b = fine[(j + 1) * step];
    for (let m = j * step + 1; m < (j + 1) * step; m++) {
      if (distanceToChordSquared(fine[m], a, b) > limit) return false;
    }
  }
  return true;
}

/**
 * How many pieces (1, 2, 4, 8 or 16) to split one trail segment's curve into.
 *
 * The fewest that satisfy both:
 *  - geometry: the polyline stays within GEOMETRY_TOLERANCE of the 16-piece curve.
 *    This looks at the curve itself, not the endpoint distance: identical
 *    endpoints (a held tablet sample at a low report rate) can still have a
 *    curved Bezier when the neighboring points pull it, and straight runs need
 *    just one piece however long they are.
 *  - paint: width and opacity change along the trail, and each piece is drawn
 *    with a single value, so steep changes (short trails change fastest per
 *    segment) need more pieces.
 * Powers of two keep the pieces nested in the 16, so the geometry guarantee
 * holds for whatever the paint demands on top.
 *
 * @param {object} p1 - segment start
 * @param {object} p2 - segment end
 * @param {{cp1x, cp1y, cp2x, cp2y}} c - Bezier control points from catmullRomToBezier
 * @param {number} [widthChange] - |line width change| across the whole segment
 * @param {number} [alphaChange] - |opacity change| across the whole segment
 */
export function subdivisionsFor(p1, p2, c, widthChange = 0, alphaChange = 0) {
  const byPaint = Math.max(1, Math.ceil(widthChange / WIDTH_TOLERANCE), Math.ceil(alphaChange / ALPHA_TOLERANCE));
  if (byPaint >= SUBDIVISIONS) return SUBDIVISIONS;

  const fine = [{ x: p1.x, y: p1.y }];
  for (let k = 1; k <= SUBDIVISIONS; k++) {
    fine.push(evalBezier(p1.x, p1.y, c.cp1x, c.cp1y, c.cp2x, c.cp2y, p2.x, p2.y, k / SUBDIVISIONS));
  }

  let geometry = SUBDIVISIONS;
  for (const pieces of [1, 2, 4, 8]) {
    if (polylineWithin(fine, pieces, GEOMETRY_TOLERANCE)) {
      geometry = pieces;
      break;
    }
  }

  const needed = Math.max(geometry, byPaint);
  let pieces = 1;
  while (pieces < needed) pieces *= 2;
  return Math.min(SUBDIVISIONS, pieces);
}

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
      const pieces = subdivisionsFor(
        p1, p2, { cp1x, cp1y, cp2x, cp2y },
        35 * scale * (t1 * t1 - t0 * t0), 0.55 * (t1 - t0),
      );

      for (let sub = 1; sub <= pieces; sub++) {
        const s = sub / pieces;
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
      const pieces = subdivisionsFor(
        p1, p2, { cp1x, cp1y, cp2x, cp2y },
        35 * scale * (t1 * t1 - t0 * t0), 0.55 * (t1 - t0),
      );

      for (let sub = 1; sub <= pieces; sub++) {
        const s = sub / pieces;
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
