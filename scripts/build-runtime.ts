import { Effect, FileSystem } from 'effect';
import { resolve, relative } from 'node:path';
import ts from 'typescript';
import { writeAtomic } from './lib/files.ts';
import { main, ToolingError } from './lib/runtime.ts';

const root = resolve(import.meta.dirname, '..');
export const runtimeRoots = [
  ['src/ui', 'includes/ui/blocks'],
  ['src/runtime', 'includes/assets/runtime'],
] as const;

export function compileRuntime(source: string, filename: string) {
  const result = ts.transpileModule(source, {
    fileName: filename,
    compilerOptions: {
      target: ts.ScriptTarget.ESNext,
      module: ts.ModuleKind.ESNext,
      moduleDetection: ts.ModuleDetectionKind.Legacy,
      newLine: ts.NewLineKind.LineFeed,
      verbatimModuleSyntax: true,
      removeComments: false,
    },
    reportDiagnostics: true,
  });
  const errors =
    result.diagnostics?.filter(
      (item) => item.category === ts.DiagnosticCategory.Error,
    ) ?? [];
  if (errors.length)
    throw new ToolingError({
      message: errors
        .map((item) => ts.flattenDiagnosticMessageText(item.messageText, '\n'))
        .join('\n'),
    });
  return `// Generated from ${filename}. Run npm run build:runtime; do not edit.\n${result.outputText}`;
}

export const buildRuntime = (check: boolean) =>
  Effect.gen(function* () {
    const fs = yield* FileSystem.FileSystem;
    let count = 0;
    const outdated: string[] = [];
    for (const [sourceRoot, outputRoot] of runtimeRoots) {
      const inputs = (yield* fs.readDirectory(resolve(root, sourceRoot), {
        recursive: true,
      }))
        .filter((file) => file.endsWith('.ts') && !file.endsWith('.d.ts'))
        .sort();
      const expected = new Set(
        inputs.map((file) => file.replace(/\.ts$/, '.js')),
      );
      const outputs = (yield* fs.readDirectory(resolve(root, outputRoot), {
        recursive: true,
      })).filter((file) => file.endsWith('.js'));
      for (const file of outputs) {
        if (!expected.has(file))
          return yield* Effect.fail(
            new ToolingError({
              message: `Unowned browser output: ${outputRoot}/${file}`,
            }),
          );
      }
      for (const file of inputs) {
        const input = `${sourceRoot}/${file}`;
        const output = resolve(root, outputRoot, file.replace(/\.ts$/, '.js'));
        const compiled = compileRuntime(
          yield* fs.readFileString(resolve(root, input)),
          input,
        );
        const current = (yield* fs.exists(output))
          ? yield* fs.readFileString(output)
          : '';
        if (current !== compiled) {
          if (check) outdated.push(relative(root, output));
          else yield* writeAtomic(output, compiled);
        }
        count++;
      }
    }
    if (outdated.length)
      return yield* Effect.fail(
        new ToolingError({
          message: `Browser assets are stale; run npm run build:runtime:\n${outdated.join('\n')}`,
        }),
      );
    console.log(`${count} browser assets ${check ? 'verified' : 'built'}.`);
  });

if (import.meta.main) main(buildRuntime(process.argv.includes('--check')));
