import { test } from 'node:test';
import assert from 'node:assert/strict';
import { computeReferenceTracks, warmupTicks } from '../src/lib/reference.js';
import { createSimulation } from '../src/lib/simulation.js';
import { periodTicks } from '../src/lib/animation.js';

const W = 800;
const H = 450;
const base = {
  pointerLatency: 0, pointerSmoothing: 0, brushLatency: 0, brushSmoothing: 0,
  penSpeed: 3, pathType: 'circle', reportRate: 60, brushSpacing: 0, brushTrailLength: 1,
};

/** Mean distance from the path centre, normalized by the pen's own mean distance. */
function meanRadius(track) {
  const cx = W / 2;
  const cy = H / 2;
  return track.reduce((s, p) => s + Math.hypot(p.x - cx, p.y - cy), 0) / track.length;
}

/** Run a live engine to steady state and record one period, the way the app does at runtime. */
function liveTrackB(params) {
  const sim = createSimulation();
  const steps = periodTicks(params.penSpeed, params.pathType);
  for (let i = 0; i < Math.max(steps * 3, 3000); i++) sim.step(W, H, params);
  const b = [];
  const a = [];
  for (let i = 0; i < steps; i++) {
    const r = sim.step(W, H, params);
    a.push(r.posA);
    b.push(r.posB);
  }
  return { a, b };
}

test('one period of ticks is recorded for each track', () => {
  const { trackA, trackB, trackC } = computeReferenceTracks(W, H, base);
  const n = periodTicks(base.penSpeed, base.pathType);
  assert.equal(trackA.length, n);
  assert.equal(trackB.length, n);
  assert.equal(trackC.length, n);
});

test('with no lag or smoothing all three tracks coincide', () => {
  const { trackA, trackB, trackC } = computeReferenceTracks(W, H, base);
  for (let i = 0; i < trackA.length; i += 50) {
    assert.deepEqual(trackB[i], trackA[i]);
    assert.deepEqual(trackC[i], trackA[i]);
  }
});

test('latency shifts the track along the path without changing its extent', () => {
  const lat = computeReferenceTracks(W, H, { ...base, pointerLatency: 40 });
  assert.ok(Math.abs(meanRadius(lat.trackB) - meanRadius(lat.trackA)) < 0.5);
  assert.notDeepEqual(lat.trackB[0], lat.trackA[0]);
});

test('smoothing shrinks the track, and matches the live steady state at a low report rate', () => {
  // The case that the old per-sample model got wrong: report rate 6 Hz, smoothing 30
  const params = { ...base, pointerSmoothing: 30, reportRate: 6 };
  const ref = computeReferenceTracks(W, H, params);
  const live = liveTrackB(params);

  const refShrink = meanRadius(ref.trackB) / meanRadius(ref.trackA);
  const liveShrink = meanRadius(live.b) / meanRadius(live.a);
  assert.ok(refShrink < 0.6, `reference shrink ${refShrink}`);
  assert.ok(Math.abs(refShrink - liveShrink) < 0.03, `reference ${refShrink} vs live ${liveShrink}`);
});

test('reference tracks track the live steady state across report rates and smoothing', () => {
  for (const [reportRate, smoothing, lat] of [[60, 20, 25], [30, 10, 10], [45, 40, 0], [10, 15, 30]]) {
    const params = { ...base, pathType: 'lissajous', pointerSmoothing: smoothing, pointerLatency: lat, reportRate };
    const ref = computeReferenceTracks(W, H, params);
    const live = liveTrackB(params);
    const diff = Math.abs(meanRadius(ref.trackB) / meanRadius(ref.trackA) - meanRadius(live.b) / meanRadius(live.a));
    assert.ok(diff < 0.03, `report ${reportRate} Hz, smoothing ${smoothing}: diff ${diff}`);
  }
});

test('computing reference tracks does not disturb a running simulation', () => {
  const sim = createSimulation();
  for (let i = 0; i < 200; i++) sim.step(W, H, base);
  const before = JSON.stringify(sim.current);
  computeReferenceTracks(W, H, { ...base, pointerSmoothing: 25 });
  assert.equal(JSON.stringify(sim.current), before);
});

// --- warm-up must cover report rate and both filter stages ---

/** Run a live engine far past convergence and record one period of B and C. */
function convergedTracks(params, warmupTicks) {
  const sim = createSimulation();
  const steps = periodTicks(params.penSpeed, params.pathType);
  for (let i = 0; i < warmupTicks; i++) sim.step(W, H, params);
  const b = [];
  const c = [];
  for (let i = 0; i < steps; i++) {
    const r = sim.step(W, H, params);
    b.push(r.posB);
    c.push(r.posC);
  }
  return { b, c };
}

const meanY = (track) => track.reduce((s, p) => s + p.y, 0) / track.length;
const meanX = (track) => track.reduce((s, p) => s + p.x, 0) / track.length;

test('warm-up grows with slower report rates and heavier smoothing', () => {
  const steps = periodTicks(3, 'circle');
  const fast = warmupTicks({ ...base, pointerSmoothing: 50, reportRate: 60 }, steps);
  const slow = warmupTicks({ ...base, pointerSmoothing: 50, reportRate: 1 }, steps);
  assert.ok(slow > fast * 10, `${slow} vs ${fast}`);
  // Brush smoothing adds to the settle time once the filters dominate the minimum
  const slowBase = { ...base, pointerSmoothing: 50, reportRate: 1 };
  assert.ok(
    warmupTicks({ ...slowBase, brushSmoothing: 50 }, steps) > warmupTicks({ ...slowBase, brushSmoothing: 0 }, steps),
  );
  // bounded for any input
  for (const bad of [NaN, -1, Infinity]) {
    const n = warmupTicks({ ...base, reportRate: bad, pointerSmoothing: bad, brushSmoothing: bad }, steps);
    assert.ok(Number.isFinite(n) && n > 0 && n <= 250000);
  }
});

test('1-2 Hz reports with maximum smoothing: pointer and brush references match a converged engine', () => {
  for (const reportRate of [1, 2]) {
    const params = {
      ...base, pointerSmoothing: 50, brushSmoothing: 50, pointerLatency: 20, brushLatency: 20, reportRate,
    };
    const ref = computeReferenceTracks(W, H, params);
    const live = convergedTracks(params, 250000);

    // Same centre and same extent, to well under a pixel (the old warm-up was ~100 px off)
    assert.ok(Math.abs(meanY(ref.trackB) - meanY(live.b)) < 1, `B y @${reportRate}Hz`);
    assert.ok(Math.abs(meanX(ref.trackB) - meanX(live.b)) < 1, `B x @${reportRate}Hz`);
    assert.ok(Math.abs(meanY(ref.trackC) - meanY(live.c)) < 1, `C y @${reportRate}Hz`);
    assert.ok(Math.abs(meanX(ref.trackC) - meanX(live.c)) < 1, `C x @${reportRate}Hz`);
  }
});
