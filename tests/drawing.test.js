import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  drawBrushStroke, subdivisionsFor, catmullRomToBezier, evalBezier,
} from '../src/lib/drawing.js';
import { createSimulation } from '../src/lib/simulation.js';

const W = 1067;
const H = 600;
const OLD_PIECES = 16; // the fixed subdivision this replaced

/** Context stub that counts stroke() calls. */
function countingContext() {
  const calls = { stroke: 0 };
  const noop = () => {};
  return {
    calls,
    save: noop, restore: noop, beginPath: noop, moveTo: noop, lineTo: noop,
    stroke() { calls.stroke++; },
    set strokeStyle(_) {}, set lineWidth(_) {}, set lineCap(_) {}, set lineJoin(_) {},
  };
}

/** A real trail: run the engine and keep the last `length` brush positions. */
function realTrail({ pathType = 'lissajous', penSpeed = 3, length = 300, spacing = 0 } = {}) {
  const sim = createSimulation();
  const params = {
    pointerLatency: 25, pointerSmoothing: 0, brushLatency: 35, brushSmoothing: 0,
    penSpeed, pathType, reportRate: 60, brushSpacing: spacing, brushTrailLength: length,
  };
  sim.warmUp(W, H, params);
  for (let i = 0; i < 3000; i++) sim.step(W, H, params);
  return sim.brushTrail.map(p => ({ x: p.x, y: p.y }));
}

function distanceToSegment(p, a, b) {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len2 = dx * dx + dy * dy;
  const t = len2 === 0 ? 0 : Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / len2));
  return Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy));
}

function distanceToPolyline(p, pts) {
  let best = Infinity;
  for (let i = 1; i < pts.length; i++) best = Math.min(best, distanceToSegment(p, pts[i - 1], pts[i]));
  return best;
}

/** The curve between trail points i-1 and i, as `n` pieces. */
function curve(trail, i, n) {
  const p0 = trail[Math.max(0, i - 2)];
  const p1 = trail[i - 1];
  const p2 = trail[i];
  const p3 = trail[Math.min(trail.length - 1, i + 1)];
  const c = catmullRomToBezier(p0, p1, p2, p3);
  const pts = [{ x: p1.x, y: p1.y }];
  for (let k = 1; k <= n; k++) {
    pts.push(evalBezier(p1.x, p1.y, c.cp1x, c.cp1y, c.cp2x, c.cp2y, p2.x, p2.y, k / n));
  }
  return pts;
}

// --- how many strokes ---

test('subdivision follows segment length, between 1 and 16 pieces', () => {
  assert.equal(subdivisionsFor({ x: 0, y: 0 }, { x: 0, y: 0 }), 1);
  assert.equal(subdivisionsFor({ x: 0, y: 0 }, { x: 2, y: 0 }), 1);
  assert.equal(subdivisionsFor({ x: 0, y: 0 }, { x: 7, y: 0 }), 3);
  assert.equal(subdivisionsFor({ x: 0, y: 0 }, { x: 1000, y: 0 }), 16);
});

test('a smooth trail at normal speed draws a fraction of the old stroke count', () => {
  const trail = realTrail({ length: 300 });
  const ctx = countingContext();
  drawBrushStroke(ctx, trail, 4, true);
  const oldCount = (trail.length - 1) * OLD_PIECES + (trail.length - 1 - Math.floor(trail.length * 0.5) + 1) * OLD_PIECES;
  assert.ok(ctx.calls.stroke * 3 < oldCount, `${ctx.calls.stroke} strokes vs ${oldCount} before`);
});

test('widely spaced points keep the full subdivision', () => {
  const trail = realTrail({ length: 100, spacing: 50 });
  const ctx = countingContext();
  drawBrushStroke(ctx, trail, 4, true);
  // 99 segments * 16 pieces for the stroke pass alone
  assert.ok(ctx.calls.stroke >= 99 * OLD_PIECES);
});

test('straight-line strokes are unchanged: one stroke per segment, plus the highlight half', () => {
  const trail = realTrail({ length: 100 });
  const ctx = countingContext();
  drawBrushStroke(ctx, trail, 4, false);
  assert.equal(ctx.calls.stroke, 99 + (100 - Math.floor(100 * 0.5)));
});

// --- the curve is the same curve ---

test('adaptive pieces stay within half a pixel of the old 16-piece curve', () => {
  const cases = [
    { pathType: 'lissajous', penSpeed: 3 },
    { pathType: 'lissajous', penSpeed: 10 },
    { pathType: 'circle', penSpeed: 3 },
    { pathType: 'star', penSpeed: 3 }, // sharp corners
    { pathType: 'star', penSpeed: 10 },
    { pathType: 'lissajous', penSpeed: 3, spacing: 12 },
    { pathType: 'star', penSpeed: 6, spacing: 30 },
  ];
  for (const c of cases) {
    const trail = realTrail({ ...c, length: 300 });
    let worst = 0;
    for (let i = 1; i < trail.length; i++) {
      const n = subdivisionsFor(trail[i - 1], trail[i]);
      const adaptive = curve(trail, i, n);
      const fine = curve(trail, i, OLD_PIECES);
      // Both must start and end on the trail points exactly
      assert.deepEqual(adaptive[adaptive.length - 1], { x: trail[i].x, y: trail[i].y });
      for (const f of fine) worst = Math.max(worst, distanceToPolyline(f, adaptive));
    }
    assert.ok(worst < 0.5, `${JSON.stringify(c)}: worst deviation ${worst.toFixed(3)} px`);
  }
});
