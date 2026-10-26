import * as PlaygroundCli from '@wp-playground/cli';
import { Effect } from 'effect';
import { attemptPromise } from './runtime.ts';

interface PlaygroundServer {
  [Symbol.asyncDispose](): Promise<void>;
}

// 3.1.60's declarations use extensionless ESM exports, which NodeNext cannot resolve.
const { runCLI } = PlaygroundCli as unknown as {
  runCLI(args: Record<string, unknown>): Promise<PlaygroundServer>;
};

export const playgroundServer = (
  options: Record<string, unknown>,
  boot = runCLI,
) =>
  Effect.acquireRelease(
    attemptPromise('Boot Playground', () => boot(options)),
    (server) =>
      attemptPromise('Stop Playground', () =>
        server[Symbol.asyncDispose](),
      ).pipe(Effect.orDie),
  );
