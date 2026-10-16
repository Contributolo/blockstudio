import { resolveExtensions } from '@tiptap/core';
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { getWysiwygExtensions } from '../../src/blocks/utils/wysiwyg-extensions';
import type { BlockstudioAttribute } from '../../src/types/block';

test('wysiwyg registers link and underline once with the field options', (t) => {
  const warn = t.mock.method(console, 'warn', () => {});
  const extensions = resolveExtensions(
    getWysiwygExtensions({
      type: 'wysiwyg',
      toolbar: { formats: { link: { attributes: { class: 'field-link' } } } },
    } as BlockstudioAttribute),
  );
  const named = (name: string) =>
    extensions.filter((extension) => extension.name === name);

  assert.deepEqual(
    named('link').map(({ options }) => ({
      autolink: options.autolink,
      openOnClick: options.openOnClick,
      class: options.HTMLAttributes.class,
    })),
    [{ autolink: false, openOnClick: false, class: 'field-link' }],
  );
  assert.equal(named('underline').length, 1);
  assert.deepEqual(
    warn.mock.calls.map((call) => call.arguments.join(' ')),
    [],
  );
});
