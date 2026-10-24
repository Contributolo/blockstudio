import assert from 'node:assert/strict';
import { test } from 'node:test';
import { extensionTargetsBlock } from '../../src/blocks/utils/extension-targets-block.ts';

test('extension exclusions win over exact names, lists and wildcards', () => {
  for (const name of ['core/*', 'core/image', ['core/*', 'core/image']]) {
    assert.equal(
      extensionTargetsBlock({ name, exclude: ['core/image'] }, 'core/image'),
      false,
    );
  }
  assert.equal(
    extensionTargetsBlock(
      { name: 'core/*', exclude: ['core/image'] },
      'core/paragraph',
    ),
    true,
  );
  assert.equal(
    extensionTargetsBlock({ name: '*', exclude: ['core/*'] }, 'core/image'),
    false,
  );
  assert.equal(
    extensionTargetsBlock({ name: '*', exclude: ['core/*'] }, 'acme/card'),
    true,
  );
});

test('omitted and empty exclusions preserve matching and unmatched blocks stay unmatched', () => {
  assert.equal(extensionTargetsBlock({ name: 'core/*' }, 'core/image'), true);
  assert.equal(
    extensionTargetsBlock({ name: 'core/*', exclude: [] }, 'core/image'),
    true,
  );
  assert.equal(
    extensionTargetsBlock({ name: 'acme/*', exclude: [] }, 'core/image'),
    false,
  );
  assert.equal(
    extensionTargetsBlock(
      { name: 'core/*', exclude: [null, 1] as any },
      'core/image',
    ),
    true,
  );
});
