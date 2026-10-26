import assert from 'node:assert/strict';
import test from 'node:test';
import { createServer } from 'node:net';
import { Cause, Effect } from 'effect';
import { playgroundServer } from '../lib/playground.ts';
import {
  blueprint,
  checkPort,
  requireSession,
  runtimeOptions,
  validateSpecs,
} from '../playground.ts';

test('the blueprint carries the wp-env constants and activates theme and plugin', () => {
  const constants = { WP_DEBUG: true, SCRIPT_DEBUG: true };
  const { preferredVersions, steps } = blueprint(constants, 'test-session');
  assert.ok(preferredVersions.php && preferredVersions.wp);
  assert.deepEqual(
    steps.map((step) => step.step),
    [
      'defineWpConfigConsts',
      'activateTheme',
      'activatePlugin',
      'setSiteOptions',
      'mkdir',
      'writeFile',
    ],
  );
  assert.deepEqual(steps[0], {
    step: 'defineWpConfigConsts',
    consts: { ...constants, BLOCKSTUDIO_PLAYGROUND_SESSION: 'test-session' },
  });
  const identity = steps.find((step) => step.step === 'writeFile');
  assert.match(String(identity?.data), /X-Blockstudio-Playground-Session/);
  assert.match(String(identity?.data), /BLOCKSTUDIO_PLAYGROUND_SESSION/);
});

test('the server and blueprint agree on versions and use explicit workers', () => {
  const { preferredVersions, extraLibraries } = blueprint({}, 'session');
  assert.deepEqual(runtimeOptions(), {
    php: preferredVersions.php,
    wp: preferredVersions.wp,
    workers: 6,
  });
  assert.deepEqual(extraLibraries, ['wp-cli']);
});

test('the SDK server is disposed after successful work', async () => {
  let stopped = 0;
  const options = { command: 'server' };
  await Effect.runPromise(
    Effect.scoped(
      playgroundServer(options, async (actual) => {
        assert.equal(actual, options);
        return {
          [Symbol.asyncDispose]: async () => {
            stopped++;
          },
        };
      }),
    ),
  );
  assert.equal(stopped, 1);
});

test('the SDK server is disposed when work fails', async () => {
  let stopped = 0;
  const exit = await Effect.runPromiseExit(
    Effect.scoped(
      Effect.gen(function* () {
        yield* playgroundServer({}, async () => ({
          [Symbol.asyncDispose]: async () => {
            stopped++;
          },
        }));
        return yield* Effect.fail(new Error('work failed'));
      }),
    ),
  );
  assert.equal(stopped, 1);
  assert.equal(exit._tag, 'Failure');
  if (exit._tag === 'Failure')
    assert.match(Cause.pretty(exit.cause), /work failed/);
});

test('SDK cleanup failures cannot produce a successful run', async () => {
  const exit = await Effect.runPromiseExit(
    Effect.scoped(
      playgroundServer({}, async () => ({
        [Symbol.asyncDispose]: async () => {
          throw new Error('cleanup failed');
        },
      })),
    ),
  );
  assert.equal(exit._tag, 'Failure');
  if (exit._tag === 'Failure')
    assert.match(Cause.pretty(exit.cause), /cleanup failed/);
});

test('readiness refuses unrelated servers and missing identities', () => {
  requireSession('expected', 'expected');
  assert.throws(
    () => requireSession(undefined, 'expected'),
    /refusing to seed/,
  );
  assert.throws(() => requireSession('other', 'expected'), /refusing to seed/);
  assert.throws(() => requireSession('', ''), /refusing to seed/);
});

test('the optional runner requires explicit compatible test files', () => {
  assert.deepEqual(validateSpecs(['tests/e2e/types/text.ts']), [
    'tests/e2e/types/text.ts',
  ]);
  for (const args of [
    [],
    ['tests/e2e'],
    ['.*'],
    ['tests/e2e/cli.ts'],
    ['tests/e2e/seo.ts'],
    ['tests/e2e/utils/playwright-utils.ts'],
    ['../other.ts'],
    ['tests/e2e/types/missing.ts'],
  ])
    assert.throws(() => validateSpecs(args));
});

test('an occupied port is rejected without touching the existing listener', async (t) => {
  const server = createServer();
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  t.after(
    () =>
      new Promise<void>((resolve, reject) =>
        server.close((error) => (error ? reject(error) : resolve())),
      ),
  );
  const address = server.address();
  assert.ok(address && typeof address !== 'string');
  await assert.rejects(checkPort(address.port), { code: 'EADDRINUSE' });
  assert.equal(server.listening, true);
});
