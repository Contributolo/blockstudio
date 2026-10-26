import { Effect, FileSystem } from 'effect';
import { resolve } from 'node:path';
import { command } from './lib/command.ts';
import { writeAtomic } from './lib/files.ts';
import { main } from './lib/runtime.ts';

const root = resolve(import.meta.dirname, '..');

export const generateTypes = (
  destination = resolve(root, 'src/types/block.ts'),
) =>
  Effect.scoped(
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const temporary = yield* fs.makeTempDirectoryScoped({
        prefix: 'blockstudio-types-',
      });
      const output = resolve(temporary, 'block.ts');
      yield* command(
        resolve(root, 'node_modules/.bin/quicktype'),
        [resolve(root, 'schemas/block.json'), '-s', 'schema', '-o', output],
        { cwd: root, inherit: true },
      );
      // Remove quicktype's runtime comments before formatting so output stays formatted.
      const source = (yield* fs.readFileString(output)).replace(
        /^[ \t]*\/\/.*\n/gm,
        '',
      );
      yield* fs.writeFileString(output, source);
      // The tracked destination is formatter-ignored; the temporary file is not.
      yield* command(
        resolve(root, 'node_modules/.bin/oxfmt'),
        ['-c', resolve(root, 'oxfmt.config.ts'), '--write', output],
        { cwd: root },
      );
      yield* writeAtomic(destination, yield* fs.readFile(output));
      console.log(`Generated ${destination}`);
    }),
  );

if (import.meta.main) main(generateTypes());
