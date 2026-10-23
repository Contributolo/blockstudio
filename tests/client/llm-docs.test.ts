import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import {
  appendFileSync,
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
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');

test('generated LLM docs preserve wildcard names, glob paths and code operators', () => {
  const path = mkdtempSync(resolve(tmpdir(), 'blockstudio-llm-'));
  try {
    mkdirSync(resolve(path, 'scripts'));
    mkdirSync(resolve(path, 'includes/llm'), { recursive: true });
    writeFileSync(resolve(path, 'package.json'), '{"type":"module"}');
    symlinkSync(
      resolve(root, 'node_modules'),
      resolve(path, 'node_modules'),
      'dir',
    );
    cpSync(resolve(root, 'scripts/lib'), resolve(path, 'scripts/lib'), {
      recursive: true,
    });
    for (const directory of ['docs', 'schemas']) {
      cpSync(resolve(root, directory), resolve(path, directory), {
        recursive: true,
      });
    }
    cpSync(
      resolve(root, 'scripts/build-llm.ts'),
      resolve(path, 'scripts/build-llm.ts'),
    );
    const examples = [
      '`core/*` and `my-plugin/*`',
      '`src/**/index.php`',
      '```json\n{"name": ["my-plugin/*", "other/*"]}\n```',
      '```php\n$total = 2 * 3 * 4;\n$glob = "src/**/index.php";\n```',
    ];
    appendFileSync(
      resolve(path, 'docs/docs/extensions.md'),
      '\n\n' + examples.join('\n\n') + '\n',
    );
    const result = spawnSync(
      process.execPath,
      [resolve(path, 'scripts/build-llm.ts')],
      { cwd: root, encoding: 'utf8' },
    );
    assert.equal(result.status, 0, result.stderr);
    const output = readFileSync(
      resolve(path, 'includes/llm/blockstudio-llm-full.txt'),
      'utf8',
    );
    for (const example of examples) {
      assert.ok(output.includes(example), `Missing literal code: ${example}`);
    }
    assert.ok(
      readFileSync(
        resolve(path, 'includes/llm/blockstudio-llm.txt'),
        'utf8',
      ).includes('/docs/extensions'),
    );
  } finally {
    rmSync(path, { recursive: true, force: true });
  }
});
