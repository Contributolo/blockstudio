import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import test from 'node:test';
import { Effect } from 'effect';
import { generateTypes } from '../generate-types.ts';
import { runtime } from '../lib/runtime.ts';

test('numeric schema constants generate formatted, deterministic block types without replacing maintained types', async (t) => {
  const root = resolve(import.meta.dirname, '../..');
  const directory = mkdtempSync(resolve(tmpdir(), 'blockstudio-type-test-'));
  t.after(() => rmSync(directory, { recursive: true, force: true }));
  const output = resolve(directory, 'block.ts');
  const maintainedPath = resolve(root, 'src/types/block.ts');
  const maintained = readFileSync(maintainedPath, 'utf8');
  const generate = () =>
    Effect.runPromise(generateTypes(output).pipe(Effect.provide(runtime)));

  await generate();
  const source = readFileSync(output, 'utf8');
  assert.match(source, /apiVersion:\s*number/);
  assert.match(source, /translate\?:\s*boolean/);
  assert.doesNotMatch(source, /^[ \t]*\/\//m);
  assert.deepEqual(readdirSync(directory), ['block.ts']);
  execFileSync(
    resolve(root, 'node_modules/.bin/oxfmt'),
    ['-c', resolve(root, 'oxfmt.config.ts'), '--check', output],
    { cwd: root, encoding: 'utf8' },
  );

  await generate();
  assert.equal(readFileSync(output, 'utf8'), source);
  assert.equal(readFileSync(maintainedPath, 'utf8'), maintained);
});
