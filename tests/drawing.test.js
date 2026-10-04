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
function realTrail({
  pathType = 'lissajous', penSpeed = 3, length = 300, spacing = 0, reportRate = 60,
} = {}) {
  const sim = createSimulation();
  const params = {
    pointerLatency: 25, pointerSmoothing: 0, brushLatency: 35, brushSmoothing: 0,
    penSpeed, pathType, reportRate, brushSpacing: spacing, brushTrailLength: length,
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

/** The Catmull-Rom segment between trail points i-1 and i, with what the renderer derives from it. */
function segment(trail, i, scale = 0.4) {
  const p0 = trail[Math.max(0, i - 2)];
  const p1 = trail[i - 1];
  const p2 = trail[i];
  const p3 = trail[Math.min(trail.length - 1, i + 1)];
  const c = catmullRomToBezier(p0, p1, p2, p3);
  const t0 = (i - 1) / trail.length;
  const t1 = i / trail.length;
  // Same inputs drawBrushStroke gives subdivisionsFor
  const widthChange = 35 * scale * (t1 * t1 - t0 * t0);
  const alphaChange = 0.55 * (t1 - t0);
  return { p1, p2, c, widthChange, alphaChange };
}

/** The curve between the segment's endpoints, as `n` pieces. */
function curve({ p1, p2, c }, n) {
  const pts = [{ x: p1.x, y: p1.y }];
  for (let k = 1; k <= n; k++) {
    pts.push(evalBezier(p1.x, p1.y, c.cp1x, c.cp1y, c.cp2x, c.cp2y, p2.x, p2.y, k / n));
  }
  return pts;
}

const piecesFor = (seg) => subdivisionsFor(seg.p1, seg.p2, seg.c, seg.widthChange, seg.alphaChange);

// --- the subdivision rule ---

test('a flat, short, slowly changing segment needs one piece', () => {
  const p = (x, y) => ({ x, y });
  const c = catmullRomToBezier(p(0, 0), p(10, 0), p(14, 0), p(18, 0));
  assert.equal(subdivisionsFor(p(10, 0), p(14, 0), c, 0.1, 0.005), 1);
});

test('a curved segment needs more pieces, capped at 16', () => {
  const p = (x, y) => ({ x, y });
  const c = catmullRomToBezier(p(0, 0), p(100, 0), p(140, 40), p(140, 140));
  const n = subdivisionsFor(p(100, 0), p(140, 40), c);
  assert.ok(n > 1 && n <= 16, String(n));
  const sharp = catmullRomToBezier(p(0, 0), p(100, 0), p(100, 0), p(100, 400));
  assert.equal(subdivisionsFor(p(100, 0), p(100, 0), sharp), 16);
});

test('identical endpoints can still need pieces when the neighbors pull the curve', () => {
  const p = (x, y) => ({ x, y });
  // A held tablet sample: p1 === p2, but p3 jumps away
  const c = catmullRomToBezier(p(0, 0), p(0, 0), p(0, 0), p(240, 0));
  assert.ok(subdivisionsFor(p(0, 0), p(0, 0), c) > 1);
});

test('steep width or opacity change forces more pieces even on a straight line', () => {
  const p = (x, y) => ({ x, y });
  const c = catmullRomToBezier(p(0, 0), p(10, 0), p(20, 0), p(30, 0));
  assert.equal(subdivisionsFor(p(10, 0), p(20, 0), c, 0, 0), 1);
  assert.equal(subdivisionsFor(p(10, 0), p(20, 0), c, 4, 0), 8);
  assert.equal(subdivisionsFor(p(10, 0), p(20, 0), c, 0, 0.12), 4);
});

// --- how many strokes ---

test('a smooth trail at normal speed draws a fraction of the old stroke count', () => {
  const trail = realTrail({ length: 300 });
  const ctx = countingContext();
  drawBrushStroke(ctx, trail, 4, true);
  const oldCount = (trail.length - 1) * OLD_PIECES + (trail.length - 1 - Math.floor(trail.length * 0.5) + 1) * OLD_PIECES;
  assert.ok(ctx.calls.stroke * 3 < oldCount, `${ctx.calls.stroke} strokes vs ${oldCount} before`);
});

test('straight-line strokes are unchanged: one stroke per segment, plus the highlight half', () => {
  const trail = realTrail({ length: 100 });
  const ctx = countingContext();
  drawBrushStroke(ctx, trail, 4, false);
  assert.equal(ctx.calls.stroke, 99 + (100 - Math.floor(100 * 0.5)));
});

// --- the curve is the same curve ---

test('adaptive pieces stay within half a pixel of the old 16-piece curve, at every report rate', () => {
  const cases = [];
  for (const reportRate of [60, 30, 10, 5, 2, 1]) {
    cases.push({ pathType: 'circle', penSpeed: 3, reportRate });
    cases.push({ pathType: 'lissajous', penSpeed: 3, reportRate });
    cases.push({ pathType: 'star', penSpeed: 3, reportRate }); // sharp corners
  }
  cases.push(
    { pathType: 'lissajous', penSpeed: 10 },
    { pathType: 'star', penSpeed: 10 },
    { pathType: 'lissajous', penSpeed: 3, spacing: 12 },
    { pathType: 'star', penSpeed: 6, spacing: 30 },
    { pathType: 'circle', penSpeed: 3, spacing: 12, reportRate: 2 },
  );

  for (const c of cases) {
    const trail = realTrail({ ...c, length: 300 });
    let worst = 0;
    for (let i = 1; i < trail.length; i++) {
      const seg = segment(trail, i);
      const n = piecesFor(seg);
      const adaptive = curve(seg, n);
      assert.deepEqual(adaptive[adaptive.length - 1], { x: seg.p2.x, y: seg.p2.y }, 'ends on the trail point');
      for (const f of curve(seg, OLD_PIECES)) worst = Math.max(worst, distanceToPolyline(f, adaptive));
    }
    assert.ok(worst < 0.5, `${JSON.stringify(c)}: worst deviation ${worst.toFixed(3)} px`);
  }
});

test('width and opacity steps are never coarser than the old 16 pieces allowed, short trails included', () => {
  for (const length of [5, 10, 30, 100, 300]) {
    for (const brushSize of [1, 10, 30]) {
      const scale = brushSize / 10;
      const trail = realTrail({ length, pathType: 'lissajous', penSpeed: 3 });
      for (let i = 1; i < trail.length; i++) {
        const seg = segment(trail, i, scale);
        const n = piecesFor(seg);
        const oldWidthStep = seg.widthChange / OLD_PIECES;
        const oldAlphaStep = seg.alphaChange / OLD_PIECES;
        assert.ok(seg.widthChange / n <= Math.max(0.5, oldWidthStep) + 1e-9,
          `length ${length}, size ${brushSize}: width step ${(seg.widthChange / n).toFixed(2)} px`);
        assert.ok(seg.alphaChange / n <= Math.max(0.03, oldAlphaStep) + 1e-9,
          `length ${length}, size ${brushSize}: alpha step ${(seg.alphaChange / n).toFixed(3)}`);
      }
    }
  }
});
