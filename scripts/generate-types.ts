import { Effect, FileSystem } from 'effect';
import { resolve } from 'node:path';
import { command } from './lib/command.ts';
import { writeAtomic } from './lib/files.ts';
import { main } from './lib/runtime.ts';

const root = resolve(import.meta.dirname, '..');

export const generateTypes = Effect.scoped(
  Effect.gen(function* () {
    const fs = yield* FileSystem.FileSystem;
    const temporary = yield* fs.makeTempDirectoryScoped({
      prefix: 'blockstudio-types-',
    });
    for (const name of ['block', 'blockstudio']) {
      const output = resolve(temporary, `${name}.ts`);
      yield* command(
        resolve(root, 'node_modules/.bin/quicktype'),
        [resolve(root, `schemas/${name}.json`), '-s', 'schema', '-o', output],
        { cwd: root, inherit: true },
      );
      yield* writeAtomic(
        resolve(root, `src/types/${name}.ts`),
        yield* fs.readFile(output),
      );
    }
    console.log('Generated src/types/block.ts and src/types/blockstudio.ts');
  }),
);

if (import.meta.main) main(generateTypes);
