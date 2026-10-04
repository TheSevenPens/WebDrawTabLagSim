import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import {
  setStorage, loadPresetList, savePreset, deletePreset, renamePreset,
  exportPresets, importPresets, PresetError, MAX_PRESETS, MAX_IMPORT_BYTES,
  MAX_NAME_LENGTH, MAX_IMPORT_NAME_LENGTH,
} from '../src/lib/presets.js';
import { DEFAULT_SETTINGS } from '../src/lib/settings.js';

const KEY = 'lag-viz-presets';

function memoryStorage(initial = {}) {
  const mem = { ...initial };
  return {
    getItem: k => (k in mem ? mem[k] : null),
    setItem: (k, v) => { mem[k] = v; },
  };
}

beforeEach(() => setStorage(memoryStorage()));

test('save, load, rename, delete round-trip', () => {
  savePreset('a', { ...DEFAULT_SETTINGS, penSpeed: 7 });
  assert.equal(loadPresetList()[0].data.penSpeed, 7);
  assert.equal(renamePreset('a', 'b'), true);
  assert.equal(loadPresetList()[0].name, 'b');
  deletePreset('b');
  assert.deepEqual(loadPresetList(), []);
});

test('legacy bare-array storage with partial data still loads, filled with defaults', () => {
  setStorage(memoryStorage({ [KEY]: JSON.stringify([{ name: 'old', data: { penSpeed: 4 } }]) }));
  const [p] = loadPresetList();
  assert.equal(p.data.penSpeed, 4);
  assert.equal(p.data.brushSize, DEFAULT_SETTINGS.brushSize);
});

test('corrupt or wrongly shaped storage reads as empty and does not break saving', () => {
  for (const raw of ['not json', '{}', '5', '[null, 3, {"name":1}]']) {
    setStorage(memoryStorage({ [KEY]: raw }));
    assert.deepEqual(loadPresetList(), [], raw);
    savePreset('ok', DEFAULT_SETTINGS);
    assert.equal(loadPresetList().length, 1, raw);
  }
});

test('unavailable storage: reads empty, writes throw a PresetError', () => {
  setStorage({
    getItem() { throw new Error('blocked'); },
    setItem() { throw new Error('quota'); },
  });
  assert.deepEqual(loadPresetList(), []);
  assert.throws(() => savePreset('x', DEFAULT_SETTINGS), PresetError);
});

test('import sanitizes hostile values', () => {
  const json = JSON.stringify([{
    name: 'bad',
    data: { penSpeed: 0, brushTrailLength: -1, aspectRatio: 1.5, screenResolution: 1e12 },
  }]);
  const res = importPresets(json);
  assert.deepEqual([res.imported, res.skipped], [1, 0]);
  assert.equal(res.adjusted, 4);
  const d = loadPresetList()[0].data;
  assert.ok(d.penSpeed > 0 && d.brushTrailLength > 0);
  assert.equal(d.aspectRatio, DEFAULT_SETTINGS.aspectRatio);
  assert.ok(d.screenResolution <= 320);
});

test('import skips invalid entries, accepts wrapped format, merges by name', () => {
  savePreset('keep', DEFAULT_SETTINGS);
  const res = importPresets(JSON.stringify({
    version: 1,
    presets: [
      null,
      { name: '', data: {} },
      { name: 'n', data: 'str' },
      { name: 'keep', data: { penSpeed: 9 } },
      { name: 'new', data: {} },
    ],
  }));
  assert.deepEqual([res.imported, res.skipped], [2, 3]);
  assert.equal(loadPresetList().find(p => p.name === 'keep').data.penSpeed, 9);
});

test('import errors are PresetErrors and leave existing presets untouched', () => {
  savePreset('keep', DEFAULT_SETTINGS);
  for (const bad of ['nope', '{"a":1}', 'x'.repeat(MAX_IMPORT_BYTES + 1)]) {
    assert.throws(() => importPresets(bad), PresetError);
  }
  assert.equal(loadPresetList().length, 1);
});

test('preset count is capped', () => {
  const many = Array.from({ length: MAX_PRESETS + 5 }, (_, i) => ({ name: `p${i}`, data: {} }));
  const res = importPresets(JSON.stringify(many));
  assert.equal(res.imported, MAX_PRESETS);
  assert.equal(res.skipped, 5);
  assert.throws(() => savePreset('one-more', DEFAULT_SETTINGS), PresetError);
});

test('export output imports back identically', () => {
  savePreset('a', { ...DEFAULT_SETTINGS, brushSize: 9 });
  const out = exportPresets();
  setStorage(memoryStorage());
  importPresets(out);
  assert.equal(loadPresetList()[0].data.brushSize, 9);
});

test('distinct long legacy names stay distinct through load and a later save', () => {
  const a = 'x'.repeat(60) + 'A';
  const b = 'x'.repeat(60) + 'B';
  setStorage(memoryStorage({ [KEY]: JSON.stringify([{ name: a, data: {} }, { name: b, data: {} }]) }));
  assert.deepEqual(loadPresetList().map(p => p.name), [a, b]);
  savePreset('unrelated', DEFAULT_SETTINGS);
  assert.deepEqual(loadPresetList().map(p => p.name), [a, b, 'unrelated']);
});

test('names are never truncated: overly long typed or imported names are refused', () => {
  const long = 'y'.repeat(MAX_NAME_LENGTH + 1);
  assert.throws(() => savePreset(long, DEFAULT_SETTINGS), PresetError);
  savePreset('keep', DEFAULT_SETTINGS);
  assert.equal(renamePreset('keep', long), false);
  assert.equal(loadPresetList()[0].name, 'keep');

  const tooLong = 'z'.repeat(MAX_IMPORT_NAME_LENGTH + 1);
  const res = importPresets(JSON.stringify([
    { name: tooLong, data: {} },
    { name: 'w'.repeat(MAX_IMPORT_NAME_LENGTH), data: {} },
  ]));
  assert.deepEqual([res.imported, res.skipped], [1, 1]);
  assert.ok(loadPresetList().some(p => p.name.length === MAX_IMPORT_NAME_LENGTH));
});

test('an existing long legacy preset can still be overwritten by exact name', () => {
  const name = 'q'.repeat(80);
  setStorage(memoryStorage({ [KEY]: JSON.stringify([{ name, data: {} }]) }));
  savePreset(name, { ...DEFAULT_SETTINGS, brushSize: 12 });
  const list = loadPresetList();
  assert.equal(list.length, 1);
  assert.equal(list[0].data.brushSize, 12);
});
