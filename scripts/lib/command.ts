import { Data, Effect, Stream } from 'effect';
import * as ChildProcess from 'effect/process/ChildProcess';
import * as ChildProcessSpawner from 'effect/process/ChildProcessSpawner';

export interface CommandOptions {
  readonly cwd?: string;
  readonly env?: Record<string, string | undefined>;
  readonly inherit?: boolean;
  readonly check?: boolean;
  readonly tee?: boolean;
}

export class CommandFailed extends Data.TaggedError('CommandFailed')<{
  readonly message: string;
  readonly exitCode: number;
  readonly stdout: string;
  readonly stderr: string;
}> {}

const collect = <E>(
  stream: Stream.Stream<Uint8Array, E>,
  output?: NodeJS.WriteStream,
) =>
  Effect.gen(function* () {
    const chunks: Uint8Array[] = [];
    yield* Stream.runForEach(stream, (chunk) =>
      Effect.sync(() => {
        chunks.push(chunk);
        output?.write(chunk);
      }),
    );
    return Buffer.concat(chunks).toString('utf8');
  });

export const command = (
  executable: string,
  args: readonly string[] = [],
  options: CommandOptions = {},
) =>
  Effect.scoped(
    Effect.gen(function* () {
      const spawner = yield* ChildProcessSpawner.ChildProcessSpawner;
      const child = yield* spawner.spawn(
        ChildProcess.make(executable, [...args], {
          cwd: options.cwd,
          env: options.env,
          extendEnv: true,
          stdin: options.inherit ? 'inherit' : 'ignore',
          stdout: options.inherit ? 'inherit' : 'pipe',
          stderr: options.inherit ? 'inherit' : 'pipe',
          forceKillAfter: '5 seconds',
        }),
      );
      const [stdout, stderr, code] = yield* Effect.all(
        [
          options.inherit
            ? Effect.succeed('')
            : collect(child.stdout, options.tee ? process.stdout : undefined),
          options.inherit
            ? Effect.succeed('')
            : collect(child.stderr, options.tee ? process.stderr : undefined),
          child.exitCode,
        ],
        { concurrency: 'unbounded' },
      );
      const exitCode = Number(code);
      if (exitCode !== 0 && options.check !== false) {
        return yield* Effect.fail(
          new CommandFailed({
            message: `${executable} ${args.join(' ')} exited with ${exitCode}${stderr ? `\n${stderr.trimEnd()}` : ''}`,
            exitCode,
            stdout,
            stderr,
          }),
        );
      }
      return { exitCode, stdout, stderr };
    }),
  );
