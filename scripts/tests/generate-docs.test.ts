import assert from 'node:assert/strict';
import {
  copyFileSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, resolve } from 'node:path';
import test from 'node:test';
import { Effect } from 'effect';
import { generateDocs } from '../generate-docs.ts';

test('docs regeneration preserves manual icon guidance and is idempotent', async (t) => {
  const root = resolve(import.meta.dirname, '../..');
  const directory = mkdtempSync(resolve(tmpdir(), 'blockstudio-docs-test-'));
  t.after(() => rmSync(directory, { recursive: true, force: true }));
  const documents = [
    'docs/docs/blocks/hooks/php.md',
    'docs/docs/blocks/attributes/field-types.md',
  ];
  const originals = documents.map((file) =>
    readFileSync(resolve(root, file), 'utf8'),
  );

  for (const file of [
    'schemas/block.json',
    'schemas/blockstudio.json',
    ...documents,
  ]) {
    const destination = resolve(directory, file);
    mkdirSync(dirname(destination), { recursive: true });
    copyFileSync(resolve(root, file), destination);
  }

  await Effect.runPromise(generateDocs(directory));
  const first = documents.map((file) =>
    readFileSync(resolve(directory, file), 'utf8'),
  );
  const manual = first[1].split('<!-- GENERATED_FIELD_TYPES_END -->')[1];
  assert.match(manual, /## Icon Loading/);
  assert.match(manual, /Fields requesting the same set share/);
  assert.match(manual, /refocusing the picker retries a failed request/);
  assert.match(manual, /`tabler-icons` supports `outline` and `filled`/);
  assert.match(first[1], /\| `toggle` \| `boolean \\\| string`/);
  assert.match(first[1], /\| `asset` \| `boolean`/);
  assert.match(first[1], /\| `mode` \| `string`/);

  await Effect.runPromise(generateDocs(directory));
  assert.deepEqual(
    documents.map((file) => readFileSync(resolve(directory, file), 'utf8')),
    first,
  );
  assert.deepEqual(
    documents.map((file) => readFileSync(resolve(root, file), 'utf8')),
    originals,
  );
});
