import { dirname, join } from 'node:path';
import { Effect, FileSystem } from 'effect';

// A sibling temporary file makes rename atomic and keeps partial outputs out of Git.
export const writeAtomic = (path: string, content: string | Uint8Array) => Effect.scoped(Effect.gen(function* () {
  const fs = yield* FileSystem.FileSystem;
  yield* fs.makeDirectory(dirname(path), { recursive: true });
  const directory = yield* fs.makeTempDirectoryScoped({ directory: dirname(path), prefix: '.blockstudio-' });
  const temporary = join(directory, 'output');
  yield* fs.writeFile(temporary, typeof content === 'string' ? new TextEncoder().encode(content) : content);
  yield* fs.rename(temporary, path);
}));
