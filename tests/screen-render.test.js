import { test } from 'node:test';
import assert from 'node:assert/strict';
import { advanceScreen, createColorBuffer, resizeScreen } from '../src/lib/screen.js';
import { TICK_MS } from '../src/lib/constants.js';

const W = 8;
const H = 2;

/** A minimal 2D context: clearRect, getImageData and putImageData over a plain array. */
function fakeScreen(width = W, height = H) {
  const pixels = new Uint8ClampedArray(width * height * 4);
  const ctx = {
    clearRect() { pixels.fill(0); },
    getImageData() { return { data: new Uint8ClampedArray(pixels) }; },
    putImageData(img) { pixels.set(img.data); },
    imageSmoothingEnabled: true,
  };
  return {
    ctx,
    canvas: { width, height },
    pixels,
    width,
    height,
    colorBuffer: createColorBuffer(width, height),
    refreshAccum: 0,
  };
}

const px = (screen, x) => Array.from(screen.pixels.slice(x * 4, x * 4 + 4));

/** Put `rgba` in pixel `x` of the screen canvas, as a draw call would. */
const paint = (screen, x, rgba) => () => screen.pixels.set(rgba, x * 4);

const OPTS = { frozen: false, simMs: TICK_MS, refreshRateHz: 60, responseTimeMs: 200 };

// --- anti-aliasing ---

test('anti-aliasing on keeps partially covered edge pixels', () => {
  const s = fakeScreen();
  advanceScreen(s, { ...OPTS, dirty: true, antiAlias: true }, () => {
    s.pixels.set([60, 140, 130, 100], 0 * 4); // light edge coverage
    s.pixels.set([60, 140, 130, 200], 1 * 4); // heavy edge coverage
    s.pixels.set([60, 140, 130, 255], 2 * 4); // solid
  });
  assert.deepEqual(px(s, 0), [60, 140, 130, 100]);
  assert.deepEqual(px(s, 1), [60, 140, 130, 200]);
  assert.deepEqual(px(s, 2), [60, 140, 130, 255]);
});

test('anti-aliasing off gives hard edges: covered pixels solid, the rest not drawn', () => {
  const s = fakeScreen();
  advanceScreen(s, { ...OPTS, dirty: true, antiAlias: false }, () => {
    s.pixels.set([60, 140, 130, 100], 0 * 4); // below the threshold
    s.pixels.set([60, 140, 130, 127], 1 * 4); // just below
    s.pixels.set([60, 140, 130, 128], 2 * 4); // at the threshold
    s.pixels.set([60, 140, 130, 200], 3 * 4); // above
    s.pixels.set([60, 140, 130, 255], 4 * 4); // solid
  });
  assert.equal(px(s, 0)[3], 0);
  assert.equal(px(s, 1)[3], 0);
  assert.deepEqual(px(s, 2), [60, 140, 130, 255]);
  assert.deepEqual(px(s, 3), [60, 140, 130, 255]);
  assert.deepEqual(px(s, 4), [60, 140, 130, 255]);
  // Every output alpha is 0 or 255: no partial coverage survives
  for (let x = 0; x < W; x++) assert.ok([0, 255].includes(px(s, x)[3]), `pixel ${x}`);
});

test('the anti-aliasing setting defaults to on', () => {
  const s = fakeScreen();
  advanceScreen(s, { ...OPTS, dirty: true }, paint(s, 0, [10, 20, 30, 100]));
  assert.equal(px(s, 0)[3], 100);
});

// --- buffer reset policy ---

test('new and resized screens start from the same transparent state', () => {
  const fresh = createColorBuffer(W, H);
  assert.ok(fresh.every(v => v === 0));

  const s = fakeScreen(4, 4);
  s.colorBuffer.fill(123); // stale content from before the resize
  resizeScreen(s, W, H);
  assert.equal(s.colorBuffer.length, fresh.length);
  assert.ok(s.colorBuffer.every(v => v === 0));
  assert.equal(s.refreshAccum, 0);
});

test('a resized screen fades exactly like a new one', () => {
  const run = (screen) => {
    advanceScreen(screen, { ...OPTS, dirty: true }, paint(screen, 3, [60, 140, 130, 255]));
    for (let i = 0; i < 20; i++) advanceScreen(screen, { ...OPTS, dirty: false }, () => {});
    return Array.from(screen.colorBuffer);
  };
  const fresh = fakeScreen();
  const resized = fakeScreen(4, 4);
  resizeScreen(resized, W, H);
  assert.deepEqual(run(resized), run(fresh));
});

// --- blending keeps hue ---

test('a fading pixel keeps its color and loses only opacity', () => {
  const s = fakeScreen();
  advanceScreen(s, { ...OPTS, dirty: true }, paint(s, 0, [60, 140, 130, 255]));
  assert.deepEqual(px(s, 0), [60, 140, 130, 255]);

  // Stop drawing it: the pixel fades toward transparent over the response time
  let previousAlpha = 255;
  for (let i = 0; i < 12; i++) {
    advanceScreen(s, { ...OPTS, dirty: false }, () => {});
    const [r, g, b, a] = px(s, 0);
    assert.ok(a < previousAlpha, `alpha should fall (tick ${i})`);
    previousAlpha = a;
    if (a > 20) {
      // not darkening toward black: color stays at the original (rounding aside)
      assert.ok(Math.abs(r - 60) <= 2 && Math.abs(g - 140) <= 2 && Math.abs(b - 130) <= 2,
        `tick ${i}: ${r},${g},${b} at alpha ${a}`);
    }
  }
  assert.ok(previousAlpha > 0, 'a 200 ms response should not be gone after 12 ticks');
});

test('blending between two colors passes through their opacity-weighted mix', () => {
  const s = fakeScreen();
  advanceScreen(s, { ...OPTS, dirty: true }, paint(s, 0, [255, 0, 0, 255])); // red
  advanceScreen(s, { ...OPTS, dirty: false }, paint(s, 0, [0, 0, 255, 255])); // then blue
  const [r, , b, a] = px(s, 0);
  assert.equal(a, 255);
  assert.ok(r > 0 && b > 0 && r + b <= 256, `mix ${r},${b}`);
});

test('a response time far longer than the run leaves the buffer almost unchanged', () => {
  const s = fakeScreen();
  advanceScreen(s, { ...OPTS, dirty: true }, paint(s, 0, [200, 100, 50, 255]));
  advanceScreen(s, { ...OPTS, dirty: false, responseTimeMs: 1e9 }, () => {});
  assert.deepEqual(px(s, 0), [200, 100, 50, 255]);
});
