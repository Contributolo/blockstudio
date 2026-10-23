import { Effect } from 'effect';
import { existsSync } from 'node:fs';
import { resolve, relative } from 'node:path';
import ts from 'typescript';
import { command } from './lib/command.ts';
import { main, ToolingError } from './lib/runtime.ts';

const root = resolve(import.meta.dirname, '..');
export const projects = [
  'tsconfig.json',
  'tsconfig.tooling.json',
  'tsconfig.browser.json',
  'packages/registry/tsconfig.check.json',
];
export const javascriptExceptions = [
  'includes/admin/assets/', // webpack output
  'includes/ui/blocks/', // build:runtime output (verified independently)
  'includes/assets/runtime/', // build:runtime output
  'lib/', // scoped upstream dependencies
  'tests/theme/', // intentionally JavaScript assets under discovery tests
  'tests/implementations/',
  'tests/ui/theme/',
  'packages/phpstan/tests/fixtures/',
];

export const auditTooling = Effect.gen(function* () {
  const files = (yield* command(
    'git',
    ['ls-files', '--cached', '--others', '--exclude-standard', '-z'],
    { cwd: root },
  )).stdout
    .split('\0')
    .filter((file) => file && existsSync(resolve(root, file)));
  const covered = new Set<string>();
  for (const project of projects) {
    const filename = resolve(root, project);
    const read = ts.readConfigFile(filename, ts.sys.readFile);
    if (read.error)
      return yield* Effect.fail(
        new ToolingError({ message: `Cannot read ${project}` }),
      );
    const config = ts.parseJsonConfigFileContent(
      read.config,
      ts.sys,
      resolve(filename, '..'),
    );
    if (config.errors.length)
      return yield* Effect.fail(
        new ToolingError({
          message: `${project}: ${ts.formatDiagnosticsWithColorAndContext(config.errors, { getCurrentDirectory: () => root, getCanonicalFileName: (path) => path, getNewLine: () => '\n' })}`,
        }),
      );
    for (const file of config.fileNames)
      covered.add(relative(root, file).replaceAll('\\', '/'));
  }
  const missing = files.filter(
    (file) => /\.[cm]?tsx?$/.test(file) && !covered.has(file),
  );
  const javascript = files.filter(
    (file) =>
      /\.[cm]?jsx?$/.test(file) &&
      !javascriptExceptions.some((prefix) => file.startsWith(prefix)),
  );
  if (missing.length || javascript.length)
    return yield* Effect.fail(
      new ToolingError({
        message: `Tooling audit failed:\n${missing
          .map((file) => `Unchecked TypeScript: ${file}`)
          .concat(javascript.map((file) => `Handwritten JavaScript: ${file}`))
          .join('\n')}`,
      }),
    );
  console.log(
    `Tooling audit passed: ${files.filter((file) => /\.[cm]?tsx?$/.test(file)).length} TypeScript files covered, no unowned JavaScript.`,
  );
});

if (import.meta.main) main(auditTooling);
