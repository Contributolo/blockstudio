import { Effect } from 'effect';
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import test from 'node:test';
import { command } from '../lib/command.ts';
import { runtime } from '../lib/runtime.ts';

const root = resolve(import.meta.dirname, '../..');

test('Oxc checks tooling helpers instead of treating nested lib directories as vendors', async (t) => {
  const directory = mkdtempSync(join(root, 'scripts', '.lint-'));
  t.after(() => rmSync(directory, { recursive: true, force: true }));
  const lib = join(directory, 'lib');
  mkdirSync(lib);
  const file = join(lib, 'helper.ts');
  writeFileSync(file, 'const unused=1;\nexport {};\n');
  const config = join(directory, 'tsconfig.json');
  writeFileSync(
    config,
    JSON.stringify({
      compilerOptions: { strict: true },
      include: ['lib/*.ts'],
    }),
  );
  const lint = await Effect.runPromise(
    command(
      resolve(root, 'node_modules/.bin/oxlint'),
      ['--tsconfig', config, '--format=json', file],
      { check: false, cwd: root },
    ).pipe(Effect.provide(runtime)),
  );
  assert.equal(lint.exitCode, 1, lint.stdout + lint.stderr);
  assert.match(lint.stdout, /no-unused-vars/);
  const format = await Effect.runPromise(
    command(resolve(root, 'node_modules/.bin/oxfmt'), ['--check', file], {
      check: false,
      cwd: root,
    }).pipe(Effect.provide(runtime)),
  );
  assert.equal(format.exitCode, 1, format.stdout + format.stderr);
  assert.match(format.stdout + format.stderr, /helper\.ts/);
});

test('Oxlint preserves React deprecation, JSX usage, unused-variable and typed dot-notation checks', async (t) => {
  const directory = mkdtempSync(join(tmpdir(), 'blockstudio-lint-'));
  t.after(() => rmSync(directory, { recursive: true, force: true }));
  const config = join(directory, 'tsconfig.json');
  writeFileSync(
    config,
    JSON.stringify({
      compilerOptions: { target: 'ES2022', jsx: 'preserve', strict: true },
      include: ['*.tsx'],
    }),
  );
  const invalid = join(directory, 'invalid.tsx');
  writeFileSync(
    invalid,
    `import React from 'react';
const unused = 1;
const record = { title: 'a' };
console.log(record['title']);
export class Old extends React.Component {
  componentWillMount() {}
  render() { return <div />; }
}`,
  );
  const result = await Effect.runPromise(
    command(
      resolve(root, 'node_modules/.bin/oxlint'),
      [
        '-c',
        resolve(root, '.oxlintrc.json'),
        '--tsconfig',
        config,
        '--format=json',
        invalid,
      ],
      { check: false, cwd: root },
    ).pipe(Effect.provide(runtime)),
  );
  assert.equal(result.exitCode, 1, result.stderr);
  assert.match(result.stdout, /no-unused-vars/);
  assert.match(result.stdout, /no-deprecated/);
  assert.match(result.stdout, /dot-notation/);

  const valid = join(directory, 'valid.tsx');
  writeFileSync(
    valid,
    `import React from 'react';
const Label = () => <div />;
export const Content = () => <Label />;`,
  );
  const clean = await Effect.runPromise(
    command(
      resolve(root, 'node_modules/.bin/oxlint'),
      [
        '-c',
        resolve(root, '.oxlintrc.json'),
        '--tsconfig',
        config,
        '--format=json',
        valid,
      ],
      { check: false, cwd: root },
    ).pipe(Effect.provide(runtime)),
  );
  assert.equal(clean.exitCode, 0, clean.stdout + clean.stderr);
});
