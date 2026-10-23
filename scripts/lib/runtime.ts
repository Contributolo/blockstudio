import * as NodeRuntime from '@effect/platform-node/NodeRuntime';
import * as NodeServices from '@effect/platform-node/NodeServices';
import { Cause, Data, Effect, Layer } from 'effect';
import * as FetchHttpClient from 'effect/http/FetchHttpClient';

export class ToolingError extends Data.TaggedError('ToolingError')<{
  readonly message: string;
  readonly cause?: unknown;
  readonly exitCode?: number;
}> {}

export const runtime = Layer.mergeAll(NodeServices.layer, FetchHttpClient.layer);
export type Services = Layer.Success<typeof runtime>;

export const attempt = <A>(name: string, run: () => A) =>
  Effect.try({
    try: run,
    catch: (cause) => new ToolingError({ message: `${name}: ${String(cause)}`, cause }),
  });

export const attemptPromise = <A>(name: string, run: (signal: AbortSignal) => Promise<A>) =>
  Effect.tryPromise({
    try: run,
    catch: (cause) => new ToolingError({ message: `${name}: ${String(cause)}`, cause }),
  });

export function main<A, E>(program: Effect.Effect<A, E, Services>) {
  let exitCode = 0;
  NodeRuntime.runMain(program.pipe(
    Effect.provide(runtime),
    Effect.catch((error) => Effect.sync(() => {
      console.error(error instanceof Error ? error.message : String(error));
      exitCode = typeof error === 'object' && error !== null && 'exitCode' in error
        && typeof error.exitCode === 'number' ? error.exitCode : 1;
    })),
  ), {
    teardown: (exit, onExit) => onExit(exit._tag === 'Failure' ? (Cause.hasInterrupts(exit.cause) ? 130 : 1) : exitCode),
  });
}
