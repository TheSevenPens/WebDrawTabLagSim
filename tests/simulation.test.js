import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  preWarm, pushBrushTrail, brushTrail, resetSimulation, computeCurrentPositions, pushHistory,
} from '../src/lib/simulation.js';
import { computeTrackA } from '../src/lib/animation.js';
import { consumeRefreshes } from '../src/lib/screen.js';

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
