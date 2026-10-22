import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  getPopulateRequest,
  resolvePopulate,
} from '../../src/blocks/utils/resolve-populate';

test('the first placeholder resolves inside an object-shaped populate configuration', () => {
  const source = {
    type: 'function',
    function: 'options',
    arguments: ['{attributes.kind.value}'],
  };
  const snapshot = structuredClone(source);
  assert.deepEqual(resolvePopulate(source, { kind: { value: 'post' } }), {
    ...source,
    arguments: ['post'],
  });
  assert.deepEqual(source, snapshot);
  assert.deepEqual(resolvePopulate(source, { kind: { value: 'page' } }), {
    ...source,
    arguments: ['page'],
  });
});

test('nested query values preserve numbers, booleans, null, arrays, and objects', () => {
  const values = {
    count: 0,
    enabled: false,
    empty: null,
    ids: [2, 3],
    filter: { relation: 'AND' },
    rows: [{ value: 4 }],
  };
  assert.deepEqual(
    resolvePopulate(
      {
        arguments: {
          numberposts: '{attributes.count}',
          sticky: '{attributes.enabled}',
          empty: '{attributes.empty}',
          post__in: '{attributes.ids}',
          meta_query: ['{attributes.filter}'],
          first: '{attributes.rows[0].value}',
          nested: { unchanged: 10 },
        },
      },
      values,
    ),
    {
      arguments: {
        numberposts: 0,
        sticky: false,
        empty: null,
        post__in: [2, 3],
        meta_query: [{ relation: 'AND' }],
        first: 4,
        nested: { unchanged: 10 },
      },
    },
  );
});

test('quoted, multiline, and Unicode values do not corrupt JSON or text interpolation', () => {
  const value = 'Say "hello" \\ path\n\u00e9';
  const resolved = resolvePopulate(
    {
      arguments: [
        '{attributes.text}',
        'prefix {attributes.text} {attributes.count}',
      ],
    },
    { text: value, count: 0 },
  );
  assert.deepEqual(resolved, { arguments: [value, `prefix ${value} 0`] });
  assert.deepEqual(JSON.parse(JSON.stringify(resolved)), resolved);
});

test('missing references and ordinary strings or scalar values stay unchanged', () => {
  for (const value of [
    '{attributes.missing}',
    'before {attributes.missing}',
    '{block.name}',
    '',
    null,
    0,
    false,
  ]) {
    assert.equal(resolvePopulate(value, {}), value);
  }
});

test('function requests keep positional arguments and do not receive query search parameters', () => {
  const source = {
    type: 'function',
    function: 'options',
    arguments: ['{attributes.kind.value}', false],
  };
  const resolved = resolvePopulate(source, {
    kind: { value: 'post' },
  }) as Record<string, unknown>;
  assert.deepEqual(getPopulateRequest(resolved, 'Item B'), {
    ...source,
    arguments: ['post', false],
  });
  assert.deepEqual(
    getPopulateRequest({ type: 'function', function: 'options' }, ''),
    { type: 'function', function: 'options' },
  );
  assert.deepEqual(
    getPopulateRequest({ type: 'custom', custom: 'options' }, 'search'),
    { type: 'custom', custom: 'options' },
  );
});

test('query requests keep their arguments and add the appropriate search values without mutation', () => {
  const source = {
    type: 'query',
    query: 'posts',
    arguments: { post_type: 'page', numberposts: 10 },
  };
  assert.deepEqual(getPopulateRequest(source, 'Docs'), {
    ...source,
    arguments: { ...source.arguments, search: 'Docs', s: 'Docs' },
  });
  assert.deepEqual(source.arguments, { post_type: 'page', numberposts: 10 });
  assert.deepEqual(
    getPopulateRequest({ type: 'query', query: 'users' }, 'Dennis').arguments,
    { search: '*Dennis*', s: 'Dennis' },
  );
  assert.deepEqual(
    getPopulateRequest({ type: 'query', query: 'users' }, '').arguments,
    { search: '', s: '' },
  );
});
