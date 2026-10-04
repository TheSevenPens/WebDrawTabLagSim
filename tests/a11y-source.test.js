import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

// Source-level guards for accessibility decisions that are easy to undo by accident.
// The real behavior needs a browser; see #40.

const canvas = readFileSync(new URL('../src/components/Canvas.svelte', import.meta.url), 'utf8');

/** The opening tag of the first element with the given class. */
function openingTag(source, className) {
  const m = source.match(new RegExp(`<[a-z]+[^>]*class="${className}"[^>]*>`));
  assert.ok(m, `no element with class "${className}"`);
  return m[0];
}

test('the frame rate readout stays readable to assistive technology and is not announced', () => {
  const tag = openingTag(canvas, 'rate-readout');
  assert.ok(!/aria-hidden/.test(tag), 'aria-hidden would remove the only copy of the values from the accessibility tree');
  assert.ok(!/aria-live|role="(status|alert|log|timer)"/.test(tag),
    'a live region would announce the values every time they update');
});
