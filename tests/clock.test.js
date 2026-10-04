import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createClock, MAX_FRAME_MS } from '../src/lib/clock.js';
import { createSimulation } from '../src/lib/simulation.js';

const params = {
  pointerLatency: 25, pointerSmoothing: 10, brushLatency: 35, brushSmoothing: 10,
  penSpeed: 3, pathType: 'lissajous', reportRate: 45, brushSpacing: 0, brushTrailLength: 180,
};

// Deterministic jitter so failures reproduce
function lcg(seed) {
  let s = seed;
  return () => (s = (s * 1664525 + 1013904223) >>> 0) / 4294967296;
}

/** Total ticks a clock yields for `seconds` of host time at the given frame schedule. */
function ticksOver(seconds, nextFrameMs) {
  const clock = createClock();
  let elapsed = 0;
  let ticks = 0;
  while (elapsed < seconds * 1000) {
    const dt = nextFrameMs();
    elapsed += dt;
    ticks += clock.advance(dt);
  }
  return { ticks, elapsed };
}

test('elapsed host time maps to the same tick count at 30/60/120/144 fps', () => {
  for (const fps of [30, 60, 120, 144, 240]) {
    const { ticks, elapsed } = ticksOver(20, () => 1000 / fps);
    const expected = elapsed / (1000 / 60);
    assert.ok(Math.abs(ticks - expected) <= 1.5, `${fps} fps: ${ticks} vs ${expected.toFixed(1)}`);
  }
});

test('jittered frame schedules still track elapsed time', () => {
  const rand = lcg(42);
  for (const fps of [30, 60, 120, 144]) {
    const nominal = 1000 / fps;
    const { ticks, elapsed } = ticksOver(20, () => nominal * (0.6 + 0.8 * rand())); // +/-40%
    const expected = elapsed / (1000 / 60);
    assert.ok(Math.abs(ticks - expected) <= 1.5, `${fps} fps jittered: ${ticks} vs ${expected.toFixed(1)}`);
  }
});

test('a 60 Hz display with small timestamp noise runs exactly one tick per frame', () => {
  // Real frame timestamps sit on the vsync grid with bounded noise (so frame
  // gaps are anti-correlated), unlike independent per-frame period errors
  const rand = lcg(7);
  const clock = createClock();
  let prev = 0;
  for (let i = 1; i <= 5000; i++) {
    const timestamp = i * (1000 / 60) + (rand() - 0.5) * 0.8; // +/-0.4 ms
    assert.equal(clock.advance(timestamp - prev), 1, `frame ${i}`);
    prev = timestamp;
  }
});

test('a fast display runs at most one tick per frame, a slow one catches up', () => {
  const fast = createClock();
  for (let i = 0; i < 500; i++) assert.ok(fast.advance(1000 / 144) <= 1);
  const slow = createClock();
  for (let i = 0; i < 100; i++) assert.ok(slow.advance(1000 / 20) >= 2);
});

test('a long background gap is capped instead of replayed', () => {
  const clock = createClock();
  const ticks = clock.advance(60000);
  assert.ok(ticks <= Math.ceil(MAX_FRAME_MS / (1000 / 60)));
  assert.equal(clock.advance(1000 / 60), 1); // and normal frames resume
});

test('bad frame times are ignored and reset clears the accumulator', () => {
  const clock = createClock();
  for (const bad of [NaN, -5, undefined, Infinity]) {
    assert.ok(clock.advance(bad) <= Math.ceil(MAX_FRAME_MS / (1000 / 60)));
  }
  clock.reset();
  assert.equal(clock.advance(5), 0);
});

test('the simulated state after a given elapsed time is the same at every frame rate', () => {
  const states = [];
  for (const fps of [30, 60, 120, 144]) {
    const clock = createClock();
    const sim = createSimulation();
    sim.reset();
    // Drive exactly 10 s of host time; compare after the same number of ticks
    let ticks = 0;
    const frames = fps * 10;
    for (let i = 0; i < frames; i++) {
      const n = clock.advance(1000 / fps);
      for (let k = 0; k < n; k++) sim.step(800, 450, params);
      ticks += n;
    }
    states.push({ fps, ticks, reports: sim.reportCount, time: sim.time });
  }
  const ref = states[0];
  for (const s of states) {
    assert.ok(Math.abs(s.ticks - ref.ticks) <= 1, JSON.stringify(s));
    assert.ok(Math.abs(s.reports - 450) <= 2, JSON.stringify(s)); // 45 Hz for 10 s
    assert.ok(Math.abs(s.time - ref.time) <= 3 * 0.001 * 1.01, JSON.stringify(s));
  }
});
