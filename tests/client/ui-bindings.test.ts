import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { runInNewContext } from 'node:vm';

function setup() {
  const window: any = {};
  runInNewContext(readFileSync('includes/ui/blocks/global-script.js', 'utf8'), {
    window,
    document: { querySelectorAll: () => [] },
  });
  const contexts: any = {
    control: { value: 5 },
    parent: { count: 0, enabled: false, text: '', rows: [{ count: 3 }] },
  };
  const getContext = (namespace = 'control') => contexts[namespace];
  const getStore = (namespace: string) => ({ state: contexts[namespace] });
  return { api: window.__bsui, contexts, getContext, getStore };
}

test('UI bindings resolve qualified context and state without dropping zero, false or empty strings', () => {
  const { api, getContext, getStore } = setup();
  for (const source of ['context', 'state']) {
    for (const [key, expected] of [
      ['count', 0],
      ['enabled', false],
      ['text', ''],
      ['rows.0.count', 3],
    ]) {
      assert.equal(
        api.resolveBinding(
          `parent::${source}.${key}`,
          'control',
          getContext,
          getStore,
        ),
        expected,
      );
    }
  }
  assert.equal(
    api.resolveBinding('context.value', 'control', getContext, getStore),
    5,
  );
  assert.equal(
    api.resolveBinding(
      '!parent::context.enabled',
      'control',
      getContext,
      getStore,
    ),
    true,
  );
  assert.equal(
    api.resolveBinding(
      'parent::!context.enabled',
      'control',
      getContext,
      getStore,
    ),
    true,
  );
});

test('UI bindings ignore invalid paths rather than evaluating code or accessing prototypes', () => {
  const { api, getContext, getStore } = setup();
  for (const expression of [
    '',
    'parent::context.missing',
    'actions.run()',
    'context.__proto__',
    'state.constructor',
    'context.count + 1',
    'a::b::context.count',
  ]) {
    assert.equal(
      api.resolveBinding(expression, 'control', getContext, getStore),
      undefined,
    );
  }
});

test('compound UI controls synchronize parent changes while uncontrolled values remain untouched', () => {
  const { api, contexts, getContext, getStore } = setup();
  api.syncValue('control', getContext, getStore);
  assert.equal(contexts.control.value, 5);
  contexts.control.valueBinding = 'parent::context.count';
  api.syncValue('control', getContext, getStore);
  assert.equal(contexts.control.value, 0);
  contexts.parent.count = 8;
  api.syncValue('control', getContext, getStore);
  assert.equal(contexts.control.value, 8);
});
