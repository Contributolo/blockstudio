import { act, createElement } from 'react';
import { JSDOM } from 'jsdom';
import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { setTimeout } from 'node:timers/promises';
import { createRoot } from 'react-dom/client';
import { CodeAssets } from '../../src/blocks/components/fields/components/code-assets';
import type { BlockstudioAttribute } from '../../src/types/block';

const originals = new Map(
  ['window', 'document', 'IS_REACT_ACT_ENVIRONMENT'].map((key) => [
    key,
    Object.getOwnPropertyDescriptor(globalThis, key),
  ]),
);
const dom = new JSDOM(
  '<div id="root"></div><iframe name="editor-canvas"></iframe>',
);
const callbacks = new Set<() => void>();
let blockExists = true;

before(() => {
  for (const [key, value] of Object.entries({
    window: dom.window,
    document: dom.window.document,
    IS_REACT_ACT_ENVIRONMENT: true,
  }))
    Object.defineProperty(globalThis, key, { configurable: true, value });
  (dom.window as any).wp = {
    data: {
      select: () => ({ getBlock: () => (blockExists ? {} : null) }),
      subscribe: (callback: () => void) => {
        callbacks.add(callback);
        return () => callbacks.delete(callback);
      },
    },
  };
});

after(() => {
  dom.window.close();
  for (const [key, descriptor] of originals) {
    if (descriptor) Object.defineProperty(globalThis, key, descriptor);
    else Reflect.deleteProperty(globalThis, key);
  }
});

test('code assets initialize in the canvas without the code editor and survive inspector unmount', async () => {
  const root = createRoot(dom.window.document.getElementById('root')!);
  const canvas = dom.window.document.querySelector('iframe')!.contentDocument!;
  const item = {
    id: 'code',
    type: 'code',
    language: 'css',
    asset: true,
  } as BlockstudioAttribute;
  const props = {
    clientId: 'asset-test',
    item,
    value: '%selector% { background: black; }',
  };
  try {
    await act(async () => root.render(createElement(CodeAssets, props)));
    const style = canvas.getElementById('blockstudio-asset-test-code');
    assert.equal(
      style?.textContent,
      '.is-root-container [data-block="asset-test"] { background: black; }',
    );
    assert.equal(dom.window.document.querySelector('.cm-editor'), null);
    await act(async () =>
      root.render(
        createElement(CodeAssets, {
          ...props,
          value: '%selector% { color: red; }',
        }),
      ),
    );
    assert.equal(
      style?.textContent,
      '.is-root-container [data-block="asset-test"] { color: red; }',
    );
    await setTimeout(5);
    await act(async () => root.unmount());
    await setTimeout(5);
    assert.ok(canvas.getElementById('blockstudio-asset-test-code'));
    blockExists = false;
    for (const callback of [...callbacks]) callback();
    assert.equal(canvas.getElementById('blockstudio-asset-test-code'), null);
    assert.equal(callbacks.size, 0);
  } finally {
    blockExists = false;
    for (const callback of [...callbacks]) callback();
  }
});
