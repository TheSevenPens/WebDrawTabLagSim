import { test } from 'node:test';
import assert from 'node:assert/strict';
import { SETTINGS, SETTING_KEYS, DEFAULT_SETTINGS, sanitizeSettings, snapToStep } from '../src/lib/settings.js';

test('defaults round-trip unchanged', () => {
  const { settings, adjusted, invalid } = sanitizeSettings({ ...DEFAULT_SETTINGS });
  assert.deepEqual(settings, DEFAULT_SETTINGS);
  assert.equal(adjusted.length + invalid.length, 0);
});

test('every default lies within its own spec', () => {
  for (const key of SETTING_KEYS) {
    const { adjusted, invalid } = sanitizeSettings({ [key]: SETTINGS[key].default });
    assert.deepEqual([...adjusted, ...invalid], [], key);
  }
});

test('omitted keys take defaults and unknown keys are dropped', () => {
  const { settings } = sanitizeSettings({ penSpeed: 5, bogus: 1 });
  assert.equal(settings.penSpeed, 5);
  assert.equal(settings.brushSize, DEFAULT_SETTINGS.brushSize);
  assert.equal('bogus' in settings, false);
});

test('out-of-range numbers are clamped', () => {
  const { settings, adjusted } = sanitizeSettings({
    penSpeed: 0, brushTrailLength: -1, screenResolution: 1e9, pointerLatency: 12.4,
  });
  assert.equal(settings.penSpeed, SETTINGS.penSpeed.min);
  assert.equal(settings.brushTrailLength, SETTINGS.brushTrailLength.min);
  assert.equal(settings.screenResolution, SETTINGS.screenResolution.max);
  assert.equal(settings.pointerLatency, 12);
  assert.deepEqual(adjusted.sort(), ['brushTrailLength', 'penSpeed', 'pointerLatency', 'screenResolution']);
});

test('wrong types, NaN and non-members fall back to defaults', () => {
  const keys = ['penSpeed', 'reportRate', 'brushSize', 'aspectRatio', 'pathType', 'pointerSize', 'showPen'];
  const { settings, invalid } = sanitizeSettings({
    penSpeed: '3', reportRate: NaN, brushSize: Infinity, aspectRatio: 1.5,
    pathType: 'spiral', pointerSize: 3, showPen: 'yes',
  });
  for (const k of keys) {
    assert.equal(settings[k], DEFAULT_SETTINGS[k], k);
    assert.ok(invalid.includes(k), k);
  }
});

test('non-object input yields defaults', () => {
  for (const bad of [null, undefined, 5, 'x', [], [1, 2]]) {
    assert.deepEqual(sanitizeSettings(bad).settings, DEFAULT_SETTINGS);
  }
});

test('numbers snap to the declared step grid and are reported as adjusted', () => {
  const { settings, adjusted } = sanitizeSettings({
    penSpeed: 0.6, screenResolution: 81, brushTrailLength: 6,
  });
  assert.equal(settings.penSpeed, 0.5);
  assert.equal(settings.screenResolution, 80);
  assert.equal(settings.brushTrailLength, 5);
  assert.deepEqual(adjusted.sort(), ['brushTrailLength', 'penSpeed', 'screenResolution']);
});

test('snapping handles ties, fractional steps and floating-point noise', () => {
  assert.equal(snapToStep(SETTINGS.penSpeed, 0.75), 1);
  assert.equal(snapToStep(SETTINGS.penSpeed, 9.9), 10);
  assert.equal(snapToStep({ min: 0.1, max: 1, step: 0.1 }, 0.3), 0.3);
  assert.equal(snapToStep({ min: 0, max: 1, step: 0.1 }, 0.30000000000000004), 0.3);
});

test('snapped values always sit on the grid a range input would use', () => {
  for (const key of SETTING_KEYS) {
    const spec = SETTINGS[key];
    if (spec.type !== 'number') continue;
    for (const raw of [spec.min - 5, spec.min, spec.min + spec.step * 0.4, spec.min + spec.step * 0.6,
      (spec.min + spec.max) / 2 + 0.123, spec.max, spec.max + 5]) {
      const v = sanitizeSettings({ [key]: raw }).settings[key];
      const n = (v - spec.min) / spec.step;
      assert.ok(Math.abs(n - Math.round(n)) < 1e-9, `${key} ${raw} -> ${v}`);
      assert.ok(v >= spec.min && v <= spec.max, key);
      assert.equal(sanitizeSettings({ [key]: v }).settings[key], v, `${key} not idempotent`);
    }
  }
});
