import { Effect, FileSystem, Fiber } from 'effect';
import assert from 'node:assert/strict';
import {
  existsSync,
  mkdtempSync,
  readFileSync,
  realpathSync,
  rmSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { command, CommandFailed } from '../lib/command.ts';
import { writeAtomic } from '../lib/files.ts';
import { runtime } from '../lib/runtime.ts';

test('commands preserve argument boundaries, streams, cwd, environment and exit status', async () => {
  const result = await Effect.runPromise(
    command(
      process.execPath,
      [
        '-e',
        'process.stdout.write(JSON.stringify([process.argv[1], process.env.BS_TEST, process.cwd()])); process.stderr.write("error"); process.exitCode = 7;',
        'a b; echo not-a-shell',
      ],
      { cwd: tmpdir(), env: { BS_TEST: 'value' }, check: false },
    ).pipe(Effect.provide(runtime)),
  );
  assert.equal(result.exitCode, 7);
  assert.equal(result.stderr, 'error');
  assert.deepEqual(JSON.parse(result.stdout), [
    'a b; echo not-a-shell',
    'value',
    realpathSync(tmpdir()),
  ]);
});

test('nonzero commands fail with a typed error instead of silently succeeding', async () => {
  const error = await Effect.runPromise(
    command(process.execPath, ['-e', 'process.exitCode = 9;']).pipe(
      Effect.flip,
      Effect.provide(runtime),
    ),
  );
  assert.ok(error instanceof CommandFailed);
  assert.equal(error.exitCode, 9);
});

test('interrupting a command kills its child before the scope closes', async (t) => {
  const directory = mkdtempSync(join(tmpdir(), 'blockstudio-command-'));
  t.after(() => rmSync(directory, { recursive: true, force: true }));
  const pidFile = join(directory, 'pid');
  await Effect.runPromise(
    Effect.gen(function* () {
      const fiber = yield* command(process.execPath, [
        '-e',
        'require("node:fs").writeFileSync(process.argv[1], String(process.pid)); setInterval(() => {}, 1000);',
        pidFile,
      ]).pipe(Effect.forkChild);
      for (let attempt = 0; !existsSync(pidFile) && attempt < 100; attempt++)
        yield* Effect.sleep('20 millis');
      assert.ok(existsSync(pidFile), 'child never started');
      const pid = Number(readFileSync(pidFile, 'utf8'));
      yield* Fiber.interrupt(fiber);
      assert.throws(() => process.kill(pid, 0), { code: 'ESRCH' });
    }).pipe(Effect.scoped, Effect.provide(runtime)),
  );
});

test('temporary directories are released on failure and atomic output is complete', async (t) => {
  const directory = mkdtempSync(join(tmpdir(), 'blockstudio-files-'));
  t.after(() => rmSync(directory, { recursive: true, force: true }));
  let temporary = '';
  await Effect.runPromise(
    Effect.scoped(
      Effect.gen(function* () {
        const fs = yield* FileSystem.FileSystem;
        temporary = yield* fs.makeTempDirectoryScoped({ directory });
        yield* writeAtomic(join(directory, 'nested/output'), 'complete');
        return yield* Effect.fail('expected');
      }),
    ).pipe(Effect.flip, Effect.provide(runtime)),
  );
  assert.equal(existsSync(temporary), false);
  assert.equal(
    readFileSync(join(directory, 'nested/output'), 'utf8'),
    'complete',
  );
});
