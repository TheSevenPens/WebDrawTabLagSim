import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRateMeter, formatRates } from '../src/lib/rate-meter.js';
import { createClock } from '../src/lib/clock.js';
import { SETTINGS, DEFAULT_SETTINGS } from '../src/lib/settings.js';

function lcg(seed) {
  let s = seed;
  return () => (s = (s * 1664525 + 1013904223) >>> 0) / 4294967296;
}

/** Run frames at `fps` for `seconds`, with timestamps on a fixed grid plus bounded noise. */
function runFrames(fps, seconds, onFrame, noiseMs = 0) {
  const rand = lcg(11);
  const frames = Math.round(fps * seconds);
  for (let i = 1; i <= frames; i++) {
    onFrame(i * (1000 / fps) + (rand() - 0.5) * noiseMs, i);
  }
}

// --- the meter ---

test('a steady frame rate reads as that rate, not one more', () => {
  for (const fps of [24, 30, 60, 75, 120, 144, 240]) {
    const m = createRateMeter();
    runFrames(fps, 3, (t) => m.record(t, 1));
    assert.ok(Math.abs(m.rate() - fps) < 0.5, `${fps} fps read as ${m.rate().toFixed(2)}`);
  }
});

test('timestamp noise does not move the reading much', () => {
  for (const fps of [30, 60, 144]) {
    const m = createRateMeter();
    runFrames(fps, 3, (t) => m.record(t, 1), 2); // +/-1 ms
    assert.ok(Math.abs(m.rate() - fps) < 1.5, `${fps} fps read as ${m.rate().toFixed(2)}`);
  }
});

test('there is no reading until there are two samples', () => {
  const m = createRateMeter();
  assert.equal(m.rate(), null);
  m.record(100, 1);
  assert.equal(m.rate(), null);
  m.record(116.7, 1);
  assert.ok(m.rate() > 0);
});

test('the reading follows a change of rate within about a window', () => {
  const m = createRateMeter({ windowMs: 1000 });
  let t = 0;
  for (let i = 0; i < 120; i++) m.record((t += 1000 / 120), 1);
  assert.ok(Math.abs(m.rate() - 120) < 1);
  for (let i = 0; i < 60; i++) m.record((t += 1000 / 30), 1); // drop to 30 fps for 2 s
  assert.ok(Math.abs(m.rate() - 30) < 1, `read ${m.rate().toFixed(1)}`);
});

test('counts per sample are summed: 0 ticks on some frames still averages out', () => {
  const m = createRateMeter();
  let t = 0;
  for (let i = 0; i < 288; i++) m.record((t += 1000 / 144), i % 2); // one tick every other frame
  assert.ok(Math.abs(m.rate() - 72) < 1, `read ${m.rate().toFixed(1)}`);
});

test('all-zero counts read as zero, not null', () => {
  const m = createRateMeter();
  let t = 0;
  for (let i = 0; i < 90; i++) m.record((t += 1000 / 60), 0);
  assert.equal(m.rate(), 0);
});

test('a long gap (a backgrounded tab) starts over instead of reading near zero', () => {
  const m = createRateMeter({ windowMs: 1000 });
  let t = 0;
  for (let i = 0; i < 60; i++) m.record((t += 1000 / 60), 1);
  m.record((t += 30000), 1); // 30 s later
  assert.equal(m.rate(), null);
  for (let i = 0; i < 30; i++) m.record((t += 1000 / 60), 1);
  assert.ok(Math.abs(m.rate() - 60) < 1);
});

test('a clock that goes backwards and bad input are handled', () => {
  const m = createRateMeter();
  m.record(500, 1);
  m.record(516, 1);
  m.record(100, 1); // time moved backwards
  assert.equal(m.rate(), null);
  m.record(NaN, 1);
  m.record(Infinity, 1);
  m.record(116, NaN);
  m.record(133, -5);
  assert.ok(m.rate() === null || (Number.isFinite(m.rate()) && m.rate() >= 0));
});

test('memory stays bounded however long it runs', () => {
  const m = createRateMeter({ windowMs: 1000 });
  let t = 0;
  for (let i = 0; i < 100000; i++) m.record((t += 1000 / 240), 1);
  assert.ok(Math.abs(m.rate() - 240) < 1);
});

test('reset forgets everything', () => {
  const m = createRateMeter();
  m.record(0, 1);
  m.record(16, 1);
  m.reset();
  assert.equal(m.rate(), null);
});

// --- the text ---

test('the readout text', () => {
  assert.equal(formatRates(144, 60), '144 fps · 60 ticks/s');
  assert.equal(formatRates(59.6, 59.9), '60 fps · 60 ticks/s');
  assert.equal(formatRates(null, null), '– fps · – ticks/s');
  assert.equal(formatRates(60, 0), '60 fps · 0 ticks/s');
  assert.equal(formatRates(undefined, NaN), '– fps · – ticks/s');
});

// --- what the readout shows with the real clock ---

/** Drive the clock the way Canvas does and return what the two meters read. */
function readoutAt(fps, { paused = false, noiseMs = 0 } = {}) {
  const clock = createClock();
  const frames = createRateMeter();
  const ticks = createRateMeter();
  let prev = 0;
  runFrames(fps, 4, (t) => {
    const n = paused ? 0 : clock.advance(t - prev);
    prev = t;
    frames.record(t, 1);
    ticks.record(t, n);
  }, noiseMs);
  return { fps: frames.rate(), tps: ticks.rate() };
}

test('the readout shows the host rate and a 60 tick/s simulation on any display', () => {
  for (const fps of [30, 60, 120, 144, 240]) {
    const { fps: shownFps, tps } = readoutAt(fps);
    assert.ok(Math.abs(shownFps - fps) < 0.5, `${fps} fps host shown as ${shownFps.toFixed(1)}`);
    assert.ok(Math.abs(tps - 60) < 1.5, `${fps} fps host: ${tps.toFixed(1)} ticks/s`);
  }
});

test('with timestamp noise the readout is still right', () => {
  for (const fps of [60, 144]) {
    const { fps: shownFps, tps } = readoutAt(fps, { noiseMs: 1.5 });
    assert.ok(Math.abs(shownFps - fps) < 1.5);
    assert.ok(Math.abs(tps - 60) < 2, `${tps.toFixed(1)} ticks/s`);
  }
});

test('while the simulation is paused the frame rate keeps reading and ticks read 0', () => {
  const { fps, tps } = readoutAt(144, { paused: true });
  assert.ok(Math.abs(fps - 144) < 0.5);
  assert.equal(tps, 0);
});

// --- the setting ---

test('the readout is a boolean setting that defaults to off', () => {
  assert.equal(SETTINGS.showRates.type, 'boolean');
  assert.equal(DEFAULT_SETTINGS.showRates, false);
});
