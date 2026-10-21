import assert from 'node:assert/strict';
import { test } from 'node:test';
import { findCssRules } from '../../src/tailwind/utils/find-css-rules';

test('class previews read escaped selectors and nested rules while skipping private stylesheets', () => {
  const originalDocument = Object.getOwnPropertyDescriptor(
    globalThis,
    'document',
  );
  const originalRule = Object.getOwnPropertyDescriptor(globalThis, 'CSSRule');
  const plain = {
    type: 1,
    selectorText: '.is-large, .other',
    cssText: '.is-large, .other { color: red; }',
  };
  const escaped = {
    type: 1,
    selectorText: '.\\32 xl\\:w-1\\/2',
    cssText: '.\\32 xl\\:w-1\\/2 { width: 50%; }',
  };
  Object.defineProperty(globalThis, 'document', {
    configurable: true,
    value: {
      styleSheets: [
        {
          get cssRules() {
            throw new Error('SecurityError');
          },
        },
        { cssRules: [plain, { type: 4, cssRules: [escaped] }] },
      ],
    },
  });
  Object.defineProperty(globalThis, 'CSSRule', {
    configurable: true,
    value: { STYLE_RULE: 1 },
  });
  try {
    assert.deepEqual(findCssRules('.is-large'), [plain.cssText]);
    assert.deepEqual(findCssRules('.\\32 xl\\:w-1\\/2'), [escaped.cssText]);
    assert.deepEqual(findCssRules('.missing'), []);
  } finally {
    if (originalDocument)
      Object.defineProperty(globalThis, 'document', originalDocument);
    else Reflect.deleteProperty(globalThis, 'document');
    if (originalRule)
      Object.defineProperty(globalThis, 'CSSRule', originalRule);
    else Reflect.deleteProperty(globalThis, 'CSSRule');
  }
});
