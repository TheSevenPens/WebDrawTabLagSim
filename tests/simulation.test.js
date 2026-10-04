import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createSimulation } from '../src/lib/simulation.js';
import { periodTicks, autoPosition } from '../src/lib/animation.js';
import { HISTORY_SIZE } from '../src/lib/constants.js';
import { consumeRefreshes, planScreenUpdate } from '../src/lib/screen.js';

const W = 800;
const H = 450;
const base = {
  pointerLatency: 25, pointerSmoothing: 0, brushLatency: 35, brushSmoothing: 0,
  penSpeed: 3, pathType: 'lissajous', reportRate: 60,
  brushSpacing: 0, brushTrailLength: 180,
};

function run(sim, ticks, params = base, opts) {
  let last;
  for (let i = 0; i < ticks; i++) last = sim.step(W, H, params, opts);
  return last;
}

// --- lag composition and filters ---

test('zero latency and smoothing pass A straight through to B and C', () => {
  const sim = createSimulation();
  const p = { ...base, pointerLatency: 0, brushLatency: 0 };
  for (let i = 0; i < 100; i++) {
    const { posA, posB, posC } = sim.step(W, H, p);
    assert.deepEqual(posB, posA);
    assert.deepEqual(posC, posA);
  }
});

test('pointer and brush latency compose: C(n) = A(n - 25 - 35)', () => {
  const sim = createSimulation();
  const as = [];
  let c;
  for (let i = 0; i < 300; i++) {
    const r = sim.step(W, H, base);
    as.push(r.posA);
    c = r.posC;
  }
  assert.deepEqual(c, as[as.length - 1 - 60]);
});

test('a stationary pen lets B and C converge onto A', () => {
  const sim = createSimulation();
  const p = { ...base, pointerSmoothing: 30, brushSmoothing: 30 };
  run(sim, 300, p); // move, then hold the pen still
  const { posA, posB, posC } = run(sim, 4000, p, { penMoving: false });
  assert.ok(Math.hypot(posB.x - posA.x, posB.y - posA.y) < 0.01);
  assert.ok(Math.hypot(posC.x - posA.x, posC.y - posA.y) < 0.01);
});

test('warm-up honors brush spacing and trail length', () => {
  const sim = createSimulation();
  const r = sim.warmUp(W, H, { ...base, brushSpacing: 50, brushTrailLength: 5 });
  assert.ok(sim.brushTrail.length <= 5);
  assert.ok(r.posA && r.posB && r.posC);
});

test('history and trail stay within capacity', () => {
  const sim = createSimulation();
  run(sim, HISTORY_SIZE * 3, { ...base, brushTrailLength: 50 });
  assert.equal(sim.brushTrail.length, 50);
});

test('trail capacity holds even when spacing skips the point', () => {
  const sim = createSimulation();
  run(sim, 100, { ...base, brushTrailLength: 50 });
  sim.pushBrushTrail({ ...sim.brushTrail[sim.brushTrail.length - 1] }, 50, 3);
  assert.equal(sim.brushTrail.length, 3);
});

test('non-positive trail capacity terminates', () => {
  const sim = createSimulation();
  sim.pushBrushTrail({ x: 1, y: 1 }, 0, -1);
  sim.pushBrushTrail({ x: 2, y: 2 }, 0, 0);
  assert.equal(sim.brushTrail.length, 1);
});

test('all positions stay finite and in bounds over a long run', () => {
  const sim = createSimulation();
  const p = { ...base, pointerSmoothing: 20, brushSmoothing: 20, reportRate: 7 };
  for (let i = 0; i < 5000; i++) {
    const { posA, posB, posC } = sim.step(W, H, p);
    for (const pos of [posA, posB, posC]) {
      assert.ok(Number.isFinite(pos.x) && Number.isFinite(pos.y));
      assert.ok(pos.x >= 0 && pos.x <= W && pos.y >= 0 && pos.y <= H);
    }
  }
});

test('bad parameters give finite results', () => {
  const sim = createSimulation();
  const { posB, posC } = run(sim, 20, {
    ...base, penSpeed: 0, pointerLatency: -5, pointerSmoothing: -3,
    brushLatency: NaN, brushSmoothing: NaN, reportRate: 0,
  });
  for (const v of [posB.x, posB.y, posC.x, posC.y]) assert.ok(Number.isFinite(v));
});

test('bad pen speeds give a bounded period', () => {
  for (const speed of [0, -1, NaN, Infinity]) {
    const n = periodTicks(speed, 'lissajous');
    assert.ok(n > 0 && n <= 100000, String(speed));
  }
});

// --- report rate ---

test('report count follows the selected rate over elapsed time', () => {
  for (const rate of [60, 45, 40, 24, 7, 1]) {
    const sim = createSimulation();
    run(sim, 600, { ...base, reportRate: rate }); // 10 s of simulated time
    assert.ok(Math.abs(sim.reportCount - rate * 10) <= 1, `${rate} Hz: ${sim.reportCount}`);
  }
});

test('B holds its position between reports', () => {
  const sim = createSimulation();
  const p = { ...base, reportRate: 6, pointerLatency: 0 }; // report every 10 ticks
  const bs = [];
  for (let i = 0; i < 60; i++) bs.push(sim.step(W, H, p).posB);
  const distinct = new Set(bs.map(b => `${b.x},${b.y}`));
  assert.equal(distinct.size, 6);
});

// --- determinism and isolation ---

test('the same settings and tick count always give the same state', () => {
  const a = run(createSimulation(), 777);
  const b = run(createSimulation(), 777);
  assert.deepEqual(a, b);
});

test('two instances are independent', () => {
  const a = createSimulation();
  const b = createSimulation();
  run(a, 100);
  run(b, 40, { ...base, pathType: 'star', pointerSmoothing: 20 });
  const bBefore = JSON.stringify(b.current);
  const trailBefore = b.brushTrail.length;

  run(a, 500);
  a.reset();
  assert.equal(JSON.stringify(b.current), bBefore);
  assert.equal(b.brushTrail.length, trailBefore);
  assert.equal(a.current, null);
  assert.equal(a.brushTrail.length, 0);
});

test('pen position depends only on simulated time', () => {
  const sim = createSimulation();
  sim.warmUp(W, H, base);
  const { posA } = sim.step(W, H, base);
  assert.deepEqual(posA, autoPosition(sim.time, W, H, 'lissajous'));
});

// --- screen layer timing ---

test('screen refreshes match elapsed time across host frame rates', () => {
  for (const [hostFps, hz] of [[60, 144], [120, 24], [30, 60], [60, 60]]) {
    const s = { refreshAccum: 0 };
    let n = 0;
    for (let i = 0; i < hostFps; i++) n += consumeRefreshes(s, 1000 / hostFps, hz);
    assert.ok(Math.abs(n - hz) <= 1, `${hostFps}fps host, ${hz}Hz: ${n}`);
  }
});

test('a long background gap is capped, not replayed', () => {
  assert.ok(consumeRefreshes({ refreshAccum: 0 }, 60000, 60) <= 16);
});

test('pausing an already-rendered screen leaves it untouched', () => {
  const s = { refreshAccum: 0 };
  const plan = planScreenUpdate(s, { dirty: false, simPaused: true, dtMs: 16.7, refreshRateHz: 60 });
  assert.equal(plan.redraw, false);
  assert.equal(s.refreshAccum, 0); // paused time must not accumulate either
});

test('a dirty screen redraws and snaps, even while the simulation is paused', () => {
  for (const simPaused of [true, false]) {
    const plan = planScreenUpdate({ refreshAccum: 0 }, { dirty: true, simPaused, dtMs: 16.7, refreshRateHz: 60 });
    assert.deepEqual(plan, { redraw: true, blendMs: Infinity });
  }
});

test('a running screen redraws only when refreshes are due, blending for all of them', () => {
  const s = { refreshAccum: 0 };
  const first = planScreenUpdate(s, { dirty: false, simPaused: false, dtMs: 5, refreshRateHz: 24 });
  assert.equal(first.redraw, false); // 5ms < 41.7ms interval
  const fast = planScreenUpdate({ refreshAccum: 0 }, { dirty: false, simPaused: false, dtMs: 16.7, refreshRateHz: 144 });
  assert.equal(fast.redraw, true);
  assert.ok(Math.abs(fast.blendMs - 2 * 1000 / 144) < 1e-9); // two refreshes due in 16.7ms
});
