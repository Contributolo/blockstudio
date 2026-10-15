import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import {
  cpSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, resolve } from 'node:path';
import { afterEach, test } from 'node:test';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const temporary: string[] = [];
const header = `msgid ""
msgstr ""
"Language: de_DE\\n"
"Content-Type: text/plain; charset=UTF-8\\n"
"Plural-Forms: nplurals=2; plural=(n != 1);\\n"

`;

afterEach(() => {
  for (const path of temporary.splice(0))
    rmSync(path, { recursive: true, force: true });
});

const fixture = (po = '') => {
  const path = mkdtempSync(resolve(tmpdir(), 'blockstudio-i18n-'));
  temporary.push(path);
  for (const directory of [
    'scripts',
    'includes',
    'languages',
    'src/utils',
    'src/blocks',
    'src/admin',
    'src/canvas',
    'src/devtools',
  ]) {
    mkdirSync(resolve(path, directory), { recursive: true });
  }
  symlinkSync(
    resolve(root, 'node_modules'),
    resolve(path, 'node_modules'),
    'dir',
  );
  writeFileSync(resolve(path, 'package.json'), '{"type":"module"}');
  cpSync(resolve(root, 'scripts/i18n.ts'), resolve(path, 'scripts/i18n.ts'));
  writeFileSync(resolve(path, 'bootstrap.php'), '<?php');
  writeFileSync(
    resolve(path, 'blockstudio.php'),
    `<?php
__('PHP text', 'blockstudio');
_x('Shared', 'context', 'blockstudio');
_n('One %s', 'Many %s', 2, 'blockstudio');
__('Foreign', 'other-domain');
`,
  );
  writeFileSync(
    resolve(path, 'src/utils/__.ts'),
    'export const __ = (text: string) => text;',
  );
  writeFileSync(
    resolve(path, 'src/blocks/index.tsx'),
    `import { __ as translate } from '@/utils/__';
translate('Add row');
translate('Custom label', true);
`,
  );
  for (const entry of [
    'admin/index.tsx',
    'canvas/index.tsx',
    'devtools/index.ts',
  ]) {
    writeFileSync(
      resolve(path, 'src', entry),
      `import { __ } from '@/utils/__'; __('Other bundle');`,
    );
  }
  writeFileSync(resolve(path, 'languages/blockstudio-de_DE.po'), header + po);
  const run = (...args: string[]) =>
    spawnSync(
      process.execPath,
      ['--import', 'tsx', resolve(path, 'scripts/i18n.ts'), ...args],
      { encoding: 'utf8' },
    );
  return {
    path,
    run,
    read: (file: string) => readFileSync(resolve(path, file), 'utf8'),
  };
};

test('extracts literal PHP and aliased TypeScript calls, compiles plural/context translations and per-handle JSON', () => {
  const { path, run, read } = fixture(`msgid "Add row"
msgstr "Zeile hinzufügen"

msgctxt "context"
msgid "Shared"
msgstr "Gemeinsam"

msgid "One %s"
msgid_plural "Many %s"
msgstr[0] "Eine %s"
msgstr[1] "Viele %s"
`);
  const result = run();
  assert.equal(result.status, 0, result.stderr);
  assert.equal(run('--check').status, 0);
  const pot = read('languages/blockstudio.pot');
  assert.match(pot, /msgid "PHP text"/);
  assert.match(pot, /msgctxt "context"/);
  assert.doesNotMatch(pot, /Custom label|Foreign/);
  const blocks = JSON.parse(
    read('languages/blockstudio-de_DE-blockstudio-blocks.json'),
  );
  assert.deepEqual(blocks.locale_data.messages['Add row'], [
    'Zeile hinzufügen',
  ]);
  assert.equal(blocks.locale_data.messages['Other bundle'], undefined);
  const compiled = read('languages/blockstudio-de_DE.l10n.php');
  assert.ok(compiled.includes(`'One %s'=>'Eine %s' . "\\0" . 'Viele %s'`));
  assert.ok(compiled.includes(`'context\u0004Shared'=>'Gemeinsam'`));
  const mo = readFileSync(resolve(path, 'languages/blockstudio-de_DE.mo'));
  assert.equal(mo.readUInt32LE(0), 0x950412de);
  assert.ok(mo.includes(Buffer.from('Eine %s\0Viele %s')));
});

test('rejects missing placeholders in every plural form', () => {
  const { run } = fixture(`msgid "One %s"
msgid_plural "Many %s"
msgstr[0] "Eine %s"
msgstr[1] "Viele"
`);
  const result = run();
  assert.equal(result.status, 1);
  assert.match(result.stderr, /placeholders \(form 1\)/);
});

test('changed plural source is marked fuzzy and not shipped as an approved translation', () => {
  const { run, read } = fixture(`msgid "One %s"
msgid_plural "Old plural %s"
msgstr[0] "Eine %s"
msgstr[1] "Viele %s"
`);
  assert.equal(run().status, 0);
  assert.match(read('languages/blockstudio-de_DE.po'), /fuzzy/);
  assert.doesNotMatch(read('languages/blockstudio-de_DE.l10n.php'), /Eine %s/);
  assert.equal(run('--check').status, 0);
});

test('source changes and runtime-composed defaults fail the catalog gate', () => {
  const { path, run } = fixture();
  assert.equal(run().status, 0);
  writeFileSync(
    resolve(path, 'src/blocks/index.tsx'),
    `import { __ } from '@/utils/__'; __('New source');`,
  );
  assert.equal(run('--check').status, 1);
  writeFileSync(
    resolve(path, 'src/blocks/index.tsx'),
    `import { __ } from '@/utils/__'; __('Value ' + value);`,
  );
  const result = run();
  assert.equal(result.status, 1);
  assert.match(result.stderr, /runtime/);
});
