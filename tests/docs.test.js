import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { SETTINGS } from '../src/lib/settings.js';

const manual = readFileSync(new URL('../USERMANUAL.md', import.meta.url), 'utf8');
const architecture = readFileSync(new URL('../ARCHITECTURE.md', import.meta.url), 'utf8');

/**
 * Each control the manual gives a range for, in the order it appears. A label
 * that appears more than once (Latency, Smoothing) lists its settings in order.
 */
const DOCUMENTED = [
  [/\*\*Speed\*\* \(([\d.]+)–([\d.]+)\)/g, ['penSpeed']],
  [/\*\*Latency\*\* \(([\d.]+)–([\d.]+)\)/g, ['pointerLatency', 'brushLatency']],
  [/\*\*Smoothing\*\* \(([\d.]+)–([\d.]+)\)/g, ['pointerSmoothing', 'brushSmoothing']],
  [/\*\*Report Rate \(Hz\)\*\* \(([\d.]+)–([\d.]+)\)/g, ['reportRate']],
  [/\*\*Size\*\* \(([\d.]+)–([\d.]+)\)/g, ['brushSize']],
  [/\*\*Spacing\*\* \(([\d.]+)–([\d.]+)\)/g, ['brushSpacing']],
  [/\*\*Trail Length\*\* \(([\d.]+)–([\d.]+)\)/g, ['brushTrailLength']],
  [/\*\*Resolution \(px\)\*\* \(([\d.]+)–([\d.]+)\)/g, ['screenResolution']],
  [/\*\*Refresh Rate \(Hz\)\*\* \(([\d.]+)–([\d.]+)\)/g, ['screenRefreshRate']],
  [/\*\*Response Time \(ms\)\*\* \(([\d.]+)–([\d.]+)\)/g, ['screenResponseTime']],
];

test('every range quoted in the user manual matches the setting it describes', () => {
  for (const [pattern, keys] of DOCUMENTED) {
    const found = [...manual.matchAll(pattern)];
    assert.equal(found.length, keys.length, `${pattern}: expected ${keys.length} mention(s), found ${found.length}`);
    found.forEach((m, i) => {
      const spec = SETTINGS[keys[i]];
      assert.deepEqual(
        [Number(m[1]), Number(m[2])], [spec.min, spec.max],
        `${keys[i]}: manual says ${m[1]}–${m[2]}, settings say ${spec.min}–${spec.max}`,
      );
    });
  }
});

test('the docs use the playback names the code uses', () => {
  for (const [name, text] of [['ARCHITECTURE.md', architecture]]) {
    assert.ok(text.includes('simPaused') && text.includes('penStopped'), `${name} should name both playback flags`);
    assert.ok(!/`frozen`/.test(text), `${name} still refers to the old \`frozen\` flag`);
  }
});

test('the architecture notes do not claim all paths share one period', () => {
  assert.ok(!/All paths share the same period/.test(architecture));
});
