import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const pkg = JSON.parse(read('package.json'));

test('the type check is a script, its dependencies are declared, and TypeScript fits svelte-check', () => {
  assert.match(pkg.scripts.check ?? '', /svelte-check/);
  assert.ok(pkg.devDependencies['svelte-check'], 'svelte-check is a dev dependency');
  const ts = pkg.devDependencies.typescript;
  assert.ok(ts, 'typescript is a dev dependency');
  // svelte-check 4 accepts typescript ^5 || ^6 as a peer
  assert.match(ts, /^\^?(5|6)\./, `typescript ${ts} is outside svelte-check's peer range`);
});

test('the type check is configured over src', () => {
  assert.ok(existsSync(new URL('../jsconfig.json', import.meta.url)));
  const cfg = JSON.parse(read('jsconfig.json'));
  assert.equal(cfg.compilerOptions.checkJs, true);
  assert.ok(cfg.include.some(g => g.startsWith('src/')));
});

test('CI and deploy both run the type check before the tests', () => {
  for (const file of ['.github/workflows/ci.yml', '.github/workflows/deploy.yml']) {
    const text = read(file);
    const check = text.indexOf('bun run check');
    const test_ = text.indexOf('bun run test');
    assert.ok(check !== -1, `${file} does not run the type check`);
    assert.ok(check < test_, `${file} should type check before running tests`);
  }
});

test('the lockfile records the type check dependencies', () => {
  const lock = read('bun.lock');
  assert.match(lock, /"svelte-check": \["svelte-check@/);
  assert.match(lock, /"typescript": \["typescript@/);
});
