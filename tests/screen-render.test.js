import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  advanceScreen, createColorBuffer, resizeScreen, opaqueColor, opaqueContext,
} from '../src/lib/screen.js';
import { drawBrushStroke } from '../src/lib/drawing.js';
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

// --- anti-aliasing off must keep the paint's own opacity ---

/**
 * A draw callback that knows about the coverage pass: `color` is what the normal
 * pass leaves in pixel `x`, `cover` is the alpha the opaque (coverage) pass leaves.
 */
const paintWithCoverage = (screen, x, color, cover) => (ctx, mode) => {
  const [r, g, b, a] = color;
  screen.pixels.set(mode && mode.coverage ? [r, g, b, cover] : [r, g, b, a], x * 4);
};

test('anti-aliasing off keeps a fully covered translucent pixel (a faint brush tail)', () => {
  const s = fakeScreen();
  // The brush tail is deliberately faint: alpha 0.08 * 255 = 20, but the pixel is fully inside the shape
  advanceScreen(s, { ...OPTS, dirty: true, antiAlias: false }, paintWithCoverage(s, 0, [60, 140, 130, 20], 255));
  assert.deepEqual(px(s, 0), [60, 140, 130, 20]); // not deleted, and not made opaque
});

test('anti-aliasing off removes edge softness but keeps the paint opacity at the edge', () => {
  const s = fakeScreen();
  // Translucent paint (opacity 0.4) over a 60% covered edge pixel: drawn alpha 0.4 * 0.6 * 255 = 61
  advanceScreen(s, { ...OPTS, dirty: true, antiAlias: false }, paintWithCoverage(s, 0, [60, 140, 130, 61], 153));
  assert.ok(Math.abs(px(s, 0)[3] - 102) <= 1, `alpha ${px(s, 0)[3]}`); // 0.4 * 255
  // Below the coverage threshold the pixel is not drawn at all, however opaque the paint
  advanceScreen(s, { ...OPTS, dirty: true, antiAlias: false }, paintWithCoverage(s, 1, [60, 140, 130, 100], 100));
  assert.equal(px(s, 1)[3], 0);
});

test('with anti-aliasing off, translucent and solid paint both stay as drawn when fully covered', () => {
  const s = fakeScreen();
  advanceScreen(s, { ...OPTS, dirty: true, antiAlias: false }, () => {});
  const draw = (ctx, mode) => {
    const cover = 255;
    for (const [x, a] of [[0, 255], [1, 140], [2, 70], [3, 20]]) {
      s.pixels.set([10, 20, 30, mode.coverage ? cover : a], x * 4);
    }
  };
  advanceScreen(s, { ...OPTS, dirty: true, antiAlias: false }, draw);
  assert.deepEqual([0, 1, 2, 3].map(x => px(s, x)[3]), [255, 140, 70, 20]);
});

test('anti-aliasing on does not run the coverage pass', () => {
  const s = fakeScreen();
  const modes = [];
  advanceScreen(s, { ...OPTS, dirty: true, antiAlias: true }, (ctx, mode) => modes.push(mode.coverage));
  assert.deepEqual(modes, [false]);
  modes.length = 0;
  advanceScreen(fakeScreen(), { ...OPTS, dirty: true, antiAlias: false }, (ctx, mode) => modes.push(mode.coverage));
  assert.deepEqual(modes, [false, true]);
});

// --- the opaque wrapper ---

test('opaqueColor drops alpha and leaves opaque colors alone', () => {
  assert.equal(opaqueColor('rgba(60, 140, 130, 0.08)'), 'rgb(60, 140, 130)');
  assert.equal(opaqueColor('rgba(110,190,180,0.15)'), 'rgb(110, 190, 180)');
  assert.equal(opaqueColor('#2e8b5780'), '#2e8b57');
  assert.equal(opaqueColor('#2e8b'), '#2e8');
  for (const same of ['#ffffff', '#222222', 'rgb(1, 2, 3)', 'red']) assert.equal(opaqueColor(same), same);
  const gradient = {};
  assert.equal(opaqueColor(gradient), gradient);
});

test('opaqueContext forces opaque styles and passes everything else through', () => {
  const calls = [];
  const ctx = {
    strokeStyle: '', fillStyle: '', globalAlpha: 1, lineWidth: 1,
    save() { calls.push(['save', this === ctx]); },
    stroke() { calls.push(['stroke', this === ctx]); },
  };
  const o = opaqueContext(ctx);
  o.strokeStyle = 'rgba(60, 140, 130, 0.08)';
  o.fillStyle = 'rgba(0, 0, 0, 0.5)';
  o.globalAlpha = 0.3;
  o.lineWidth = 7;
  o.save();
  o.stroke();
  assert.equal(ctx.strokeStyle, 'rgb(60, 140, 130)');
  assert.equal(ctx.fillStyle, 'rgb(0, 0, 0)');
  assert.equal(ctx.globalAlpha, 1);
  assert.equal(ctx.lineWidth, 7);
  assert.deepEqual(calls, [['save', true], ['stroke', true]]); // methods run on the real context
});

test('the brush stroke drawn through the opaque wrapper uses no transparent colors', () => {
  const styles = [];
  const noop = () => {};
  const stub = {
    save: noop, restore: noop, beginPath: noop, moveTo: noop, lineTo: noop, stroke: noop,
    set strokeStyle(v) { styles.push(v); }, set lineWidth(_) {}, set lineCap(_) {}, set lineJoin(_) {},
  };
  const trail = Array.from({ length: 40 }, (_, i) => ({ x: i * 3, y: 10 + Math.sin(i / 5) * 8 }));
  for (const smooth of [false, true]) {
    styles.length = 0;
    drawBrushStroke(opaqueContext(stub), trail, 4, smooth);
    assert.ok(styles.length > 0);
    assert.ok(styles.every(c => /^rgb\(/.test(c)), `smooth=${smooth}: ${styles.find(c => !/^rgb\(/.test(c))}`);
  }
});
