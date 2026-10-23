import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const script = fileURLToPath(new URL('./start-wp-env.ts', import.meta.url));

function runSetup(scenario: string, mode: string | null = 'mu-plugin') {
  const directory = mkdtempSync(join(tmpdir(), 'blockstudio-loading-'));
  const calls = join(directory, 'calls');
  writeFileSync(
    join(directory, 'npm'),
    `#!/usr/bin/env bash
set -eu
echo "$*" >> "$CALLS"
case "$SCENARIO" in
  success) exit 0 ;;
  database)
    if [ "$(wc -l < "$CALLS")" -gt 1 ]; then exit 0; fi
    echo 'Error: Error establishing a database connection.' >&2
    exit 1 ;;
  permanent)
    echo 'Error: Error establishing a database connection.' >&2
    exit 7 ;;
  unrelated) echo 'PHP Fatal error: Broken plugin.' >&2; exit 9 ;;
esac
`,
    { mode: 0o755 },
  );
  try {
    const result = spawnSync(
      process.execPath,
      mode === null ? [script] : [script, mode],
      {
        encoding: 'utf8',
        env: {
          ...process.env,
          PATH: `${directory}:${process.env.PATH}`,
          CALLS: calls,
          SCENARIO: scenario,
        },
      },
    );
    const commands =
      result.status === 64
        ? []
        : readFileSync(calls, 'utf8').trim().split('\n');
    return { ...result, commands };
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
}

test('successful setup runs once for every supported WordPress environment', () => {
  const environments = {
    main: 'wp-env:start',
    ui: 'wp-env:start',
    empty: 'wp-env:empty:start',
    plugin: 'wp-env:implementations:plugin:start',
    'mu-plugin': 'wp-env:implementations:mu-plugin:start',
    'composer-theme': 'wp-env:implementations:composer-theme:start',
    'composer-plugin': 'wp-env:implementations:composer-plugin:start',
  };
  for (const [mode, command] of Object.entries(environments)) {
    const result = runSetup('success', mode);
    assert.equal(result.status, 0);
    assert.deepEqual(result.commands, [
      mode === 'ui' ? `--prefix tests/ui run ${command}` : `run ${command}`,
    ]);
  }
});

test('the default environment starts the main WordPress instance', () => {
  const result = runSetup('success', null);
  assert.equal(result.status, 0);
  assert.deepEqual(result.commands, ['run wp-env:start']);
});

test('cold database setup gets one retry', () => {
  const result = runSetup('database');
  assert.equal(result.status, 0);
  assert.equal(result.commands.length, 2);
  assert.match(result.stderr, /Retrying wp-env setup once/);
});

test('UI setup retries only a cold database error and preserves failures', () => {
  const recovered = runSetup('database', 'ui');
  assert.equal(recovered.status, 0);
  assert.deepEqual(
    recovered.commands,
    Array(2).fill('--prefix tests/ui run wp-env:start'),
  );
  const permanent = runSetup('permanent', 'ui');
  assert.equal(permanent.status, 7);
  assert.equal(permanent.commands.length, 2);
  const unrelated = runSetup('unrelated', 'ui');
  assert.equal(unrelated.status, 9);
  assert.equal(unrelated.commands.length, 1);
});

test('persistent database errors remain failures after one retry', () => {
  const result = runSetup('permanent');
  assert.equal(result.status, 7);
  assert.equal(result.commands.length, 2);
});

test('unrelated failures are not retried or hidden', () => {
  const result = runSetup('unrelated');
  assert.equal(result.status, 9);
  assert.equal(result.commands.length, 1);
});

test('unknown environments fail before invoking npm', () => {
  const result = runSetup('success', 'unknown');
  assert.equal(result.status, 64);
  assert.deepEqual(result.commands, []);
});
