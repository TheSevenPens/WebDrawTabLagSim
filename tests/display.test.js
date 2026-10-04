import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createClock } from '../src/lib/clock.js';
import { createSimulation } from '../src/lib/simulation.js';
import { advanceScreen } from '../src/lib/screen.js';
import { TICK_MS } from '../src/lib/constants.js';

const W = 800;
const H = 450;
const SCREEN_W = 40;
const SCREEN_H = 4;

const params = {
  pointerLatency: 0, pointerSmoothing: 0, brushLatency: 0, brushSmoothing: 0,
  penSpeed: 6, pathType: 'circle', reportRate: 60, brushSpacing: 0, brushTrailLength: 1,
};

/** A minimal 2D context: enough for clearRect, per-pixel drawing, getImageData and putImageData. */
function fakeScreen() {
  const pixels = new Uint8ClampedArray(SCREEN_W * SCREEN_H * 4);
  const ctx = {
    clearRect() { pixels.fill(0); },
    getImageData() { return { data: new Uint8ClampedArray(pixels) }; },
    putImageData(img) { pixels.set(img.data); },
  };
  return {
    ctx, pixels, width: SCREEN_W, height: SCREEN_H,
    colorBuffer: new Float32Array(SCREEN_W * SCREEN_H * 4),
    refreshAccum: 0,
  };
}

/**
 * Drive clock + engine + display exactly as Canvas does, for host frames at `fps`,
 * stopping at exactly `totalTicks` simulation ticks.
 */
function runHost(fps, totalTicks, { refreshRateHz, responseTimeMs }) {
  const clock = createClock();
  const sim = createSimulation();
  const screen = fakeScreen();
  let done = 0;
  let dirty = true;
  sim.warmUp(W, H, params); // as Canvas does on mount, so there is always a current state

  // Draw the pointer as one opaque pixel in the column its x position maps to
  const draw = () => {
    const col = Math.min(SCREEN_W - 1, Math.max(0, Math.floor(sim.current.posB.x / W * SCREEN_W)));
    const i = (1 * SCREEN_W + col) * 4;
    screen.pixels[i] = 255;
    screen.pixels[i + 3] = 255;
  };
  const update = (simMs) => {
    const d = dirty;
    dirty = false;
    advanceScreen(screen, { dirty: d, simPaused: false, simMs, refreshRateHz, responseTimeMs }, draw);
  };

  while (done < totalTicks) {
    const ticks = Math.min(clock.advance(1000 / fps), totalTicks - done);
    for (let i = 0; i < ticks; i++) {
      sim.step(W, H, params);
      update(TICK_MS); // the display sees every tick's state
      done++;
    }
    update(0);
  }
  return { colorBuffer: Array.from(screen.colorBuffer), pixels: Array.from(screen.pixels), posB: sim.current.posB };
}

test('display buffers agree at matching simulated times across host frame rates', () => {
  for (const settings of [
    { refreshRateHz: 60, responseTimeMs: 200 },
    { refreshRateHz: 24, responseTimeMs: 200 },
    { refreshRateHz: 144, responseTimeMs: 50 },
    { refreshRateHz: 10, responseTimeMs: 100 },
  ]) {
    const ref = runHost(60, 480, settings);
    for (const fps of [30, 120, 144]) {
      const got = runHost(fps, 480, settings);
      assert.deepEqual(got.posB, ref.posB, `engine state, ${fps} fps`);
      assert.deepEqual(got.colorBuffer, ref.colorBuffer, `display buffer at ${fps} fps vs 60: ${JSON.stringify(settings)}`);
      assert.deepEqual(got.pixels, ref.pixels);
    }
  }
});

test('the display really is ghosting in this scenario (the comparison is not vacuous)', () => {
  const { colorBuffer } = runHost(60, 480, { refreshRateHz: 60, responseTimeMs: 200 });
  const lit = colorBuffer.filter((v, i) => i % 4 === 0 && v > 1 && v < 254).length;
  assert.ok(lit >= 3, `expected a ghost trail, found ${lit} partially lit pixels`);
});
