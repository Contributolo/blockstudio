import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';
import ts from 'typescript';

const heavy = /^(@codemirror|@lezer|@uiw|@tiptap|prosemirror)/;

const resolve = (from: string, specifier: string) => {
  const base = specifier.startsWith('@/')
    ? join('src', specifier.slice(2))
    : join(from, '..', specifier);

  return [
    `${base}.ts`,
    `${base}.tsx`,
    join(base, 'index.ts'),
    join(base, 'index.tsx'),
  ].find(existsSync);
};

const staticClosure = (entry: string) => {
  const files = new Set<string>();
  const libraries = new Map<string, string>();
  const queue = [entry];

  while (queue.length) {
    const file = queue.pop() as string;
    if (files.has(file)) continue;
    files.add(file);

    const source = ts.createSourceFile(
      file,
      readFileSync(file, 'utf8'),
      ts.ScriptTarget.Latest,
      true,
    );
    for (const statement of source.statements) {
      if (
        (!ts.isImportDeclaration(statement) &&
          !ts.isExportDeclaration(statement)) ||
        !statement.moduleSpecifier ||
        !ts.isStringLiteral(statement.moduleSpecifier) ||
        (ts.isImportDeclaration(statement) &&
          statement.importClause?.isTypeOnly) ||
        (ts.isExportDeclaration(statement) && statement.isTypeOnly)
      )
        continue;
      const specifier = statement.moduleSpecifier.text;
      if (heavy.test(specifier)) libraries.set(specifier, file);
      const next = /^(@\/|\.)/.test(specifier)
        ? resolve(file, specifier)
        : undefined;
      if (next) queue.push(next);
    }
  }

  return { files, libraries };
};

test('the editor entry does not statically reach the code and rich text editors', () => {
  const { files, libraries } = staticClosure('src/blocks/index.tsx');

  assert.deepEqual([...libraries], []);
  for (const field of ['attributes', 'classes', 'code', 'wysiwyg']) {
    assert.ok(
      ![...files].some((file) =>
        file.includes(`fields/components/${field}.tsx`),
      ) &&
        ![...files].some((file) =>
          file.includes(`fields/components/${field}/`),
        ),
      `${field} field is imported statically`,
    );
  }
});

test('lazy fields load as named chunks', () => {
  const source = readFileSync(
    'src/blocks/components/fields/lazy-fields.tsx',
    'utf8',
  );

  for (const name of ['attributes', 'classes', 'code', 'wysiwyg']) {
    assert.match(
      source,
      new RegExp(`webpackChunkName: "blocks/field-${name}"`),
    );
  }
});
