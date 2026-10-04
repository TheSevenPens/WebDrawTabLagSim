import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  preWarm, pushBrushTrail, brushTrail, resetSimulation, computeCurrentPositions, pushHistory,
} from '../src/lib/simulation.js';
import { computeTrackA } from '../src/lib/animation.js';
import { consumeRefreshes, planScreenUpdate } from '../src/lib/screen.js';

const base = {
  pointerLatency: 25, pointerSmoothing: 0, brushLatency: 35, brushSmoothing: 0,
  penSpeed: 3, pathType: 'lissajous', reportRate: 60,
};

test('warm-up honors brush spacing and trail length', () => {
  resetSimulation();
  const r = preWarm(800, 450, { ...base, brushSpacing: 50, brushTrailLength: 5 });
  assert.ok(brushTrail.length <= 5);
  assert.ok(r.posA && r.posB && r.posC);
});

test('trail capacity holds even when spacing skips the point', () => {
  resetSimulation();
  preWarm(800, 450, { ...base, brushTrailLength: 50 });
  const last = brushTrail[brushTrail.length - 1];
  pushBrushTrail({ ...last }, 50, 3);
  assert.equal(brushTrail.length, 3);
});

test('non-positive trail capacity terminates', () => {
  resetSimulation();
  pushBrushTrail({ x: 1, y: 1 }, 0, -1);
  pushBrushTrail({ x: 2, y: 2 }, 0, 0);
  assert.equal(brushTrail.length, 1);
});

test('bad pen speeds give finite tracks', () => {
  for (const speed of [0, -1, NaN, Infinity]) {
    const track = computeTrackA(800, 450, speed, 'lissajous');
    assert.ok(track.length > 0 && track.length <= 100000, String(speed));
  }
});

test('bad lag parameters give finite positions', () => {
  resetSimulation();
  for (let i = 0; i < 10; i++) pushHistory({ x: i, y: i });
  const { posB, posC } = computeCurrentPositions(800, 450, {
    pointerLatency: -5, pointerSmoothing: -3, brushLatency: NaN, brushSmoothing: NaN, reportRate: 0,
  });
  for (const v of [posB.x, posB.y, posC.x, posC.y]) assert.ok(Number.isFinite(v));
});

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
  const plan = planScreenUpdate(s, { dirty: false, frozen: true, dtMs: 16.7, refreshRateHz: 60 });
  assert.equal(plan.redraw, false);
  assert.equal(s.refreshAccum, 0); // frozen time must not accumulate either
});

test('a dirty screen redraws and snaps, even while frozen', () => {
  for (const frozen of [true, false]) {
    const plan = planScreenUpdate({ refreshAccum: 0 }, { dirty: true, frozen, dtMs: 16.7, refreshRateHz: 60 });
    assert.deepEqual(plan, { redraw: true, blendMs: Infinity });
  }
});

test('a running screen redraws only when refreshes are due, blending for all of them', () => {
  const s = { refreshAccum: 0 };
  const first = planScreenUpdate(s, { dirty: false, frozen: false, dtMs: 5, refreshRateHz: 24 });
  assert.equal(first.redraw, false); // 5ms < 41.7ms interval
  const fast = planScreenUpdate({ refreshAccum: 0 }, { dirty: false, frozen: false, dtMs: 16.7, refreshRateHz: 144 });
  assert.equal(fast.redraw, true);
  assert.ok(Math.abs(fast.blendMs - 2 * 1000 / 144) < 1e-9); // two refreshes due in 16.7ms
});
