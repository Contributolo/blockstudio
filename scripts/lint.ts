import { Effect } from 'effect';
import { resolve } from 'node:path';
import { command } from './lib/command.ts';
import { main } from './lib/runtime.ts';

const root = resolve(import.meta.dirname, '..');
export const lintProjects = [
  {
    config: 'tsconfig.json',
    paths: ['src', 'tests'],
    exclude: [
      'src/ui/**',
      'src/runtime/**',
      'tests/ui/seed.ts',
      'tests/ui/screenshots.ts',
    ],
  },
  {
    config: 'tsconfig.tooling.json',
    paths: [
      'scripts',
      'evals',
      ...[
        'webpack',
        'oxfmt',
        'playwright.wp-env',
        'playwright.wp-env.empty',
      ].map((name) => `${name}.config.ts`),
      'tests/ui/seed.ts',
      'tests/ui/screenshots.ts',
    ],
    exclude: [],
  },
  {
    config: 'tsconfig.browser.json',
    paths: ['src/ui', 'src/runtime'],
    exclude: [],
  },
  {
    config: 'packages/registry/tsconfig.check.json',
    paths: ['packages/registry'],
    exclude: [],
  },
] as const;

export const lint = (args: string[]) =>
  Effect.gen(function* () {
    for (const project of lintProjects) {
      yield* command(
        resolve(root, 'node_modules/.bin/oxlint'),
        [
          '--tsconfig',
          project.config,
          ...project.exclude.flatMap((pattern) => [
            '--ignore-pattern',
            pattern,
          ]),
          ...args,
          ...project.paths,
        ],
        { cwd: root, inherit: true },
      );
    }
  });

if (import.meta.main) main(lint(process.argv.slice(2)));
