import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  getDefaults,
  getRepeaterRowDefaults,
} from '../../src/blocks/utils/get-defaults';
import { needsFieldInitialization } from '../../src/blocks/utils/needs-field-initialization';

const fields = [
  {
    id: 'rows',
    field: 'repeater',
    type: 'array',
    min: 2,
    attributes: [
      { id: 'title', type: 'string', field: 'text', default: 'Row' },
      {
        id: 'nested',
        type: 'array',
        field: 'repeater',
        min: 2,
        attributes: [
          { id: 'count', type: 'number', field: 'number', default: 5 },
        ],
      },
    ],
  },
] as unknown as Parameters<typeof getDefaults>[0];

test('fresh repeater defaults contain all nested minimum rows before any UI mounts', () => {
  assert.deepEqual(getDefaults(fields), {
    rows: [
      { title: 'Row', nested: [{ count: 5 }, { count: 5 }] },
      { title: 'Row', nested: [{ count: 5 }, { count: 5 }] },
    ],
  });
});

test('default rows and nested object values are independent of their siblings and definitions', () => {
  const defaults = getDefaults(fields) as {
    rows: { nested: { count: number }[] }[];
  };
  defaults.rows[0].nested[0].count = 20;
  assert.equal(defaults.rows[1].nested[0].count, 5);
  assert.equal(
    (getDefaults(fields) as typeof defaults).rows[0].nested[0].count,
    5,
  );
});

test('adding repeater rows initializes nested minimums instead of saving a false sentinel', () => {
  const definitions = [
    { id: 'body', field: 'wysiwyg', type: 'string', default: false },
    { ...fields[0], default: false },
  ] as Parameters<typeof getRepeaterRowDefaults>[0];
  const row = getRepeaterRowDefaults(definitions);
  assert.deepEqual(row, {
    body: false,
    rows: [
      { title: 'Row', nested: [{ count: 5 }, { count: 5 }] },
      { title: 'Row', nested: [{ count: 5 }, { count: 5 }] },
    ],
  });
  const another = getRepeaterRowDefaults(definitions);
  (row.rows as { nested: { count: number }[] }[])[0].nested[0].count = 20;
  assert.deepEqual(another, getRepeaterRowDefaults(definitions));
});

test('added rows retain defaults in tabs and anonymous groups, excluding named groups', () => {
  const definitions = [
    {
      type: 'tabs',
      tabs: [{ attributes: [fields[0]] }],
    },
    {
      type: 'group',
      attributes: [{ id: 'title', type: 'string', default: 'Title' }],
    },
    {
      id: 'ignored',
      type: 'group',
      attributes: [{ id: 'hidden', type: 'string', default: 'Hidden' }],
    },
  ] as Parameters<typeof getRepeaterRowDefaults>[0];
  assert.deepEqual(getRepeaterRowDefaults(definitions), {
    rows: getDefaults(fields).rows,
    title: 'Title',
  });
});

test('explicit repeater defaults override min and keep zero, false and empty values', () => {
  const definition = [
    {
      ...fields[0],
      default: [{ title: '', count: 0, enabled: false, nested: [] }],
    },
  ];
  assert.deepEqual(getDefaults(definition).rows, [
    { title: '', count: 0, enabled: false, nested: [] },
  ]);
  assert.deepEqual(getDefaults([{ ...fields[0], default: [] }]).rows, []);
  for (const rows of [[], false, null, [{ title: 'Saved', nested: [] }]]) {
    assert.equal(getDefaults(fields, { rows }).rows, rows);
  }
});

test('ordinary fields, complete stored repeaters and empty saved lists need no portal', () => {
  const definitions = [
    { id: 'title', type: 'text' },
    {
      id: 'rows',
      type: 'repeater',
      min: 2,
      attributes: [{ id: 'body', type: 'wysiwyg' }],
    },
  ];
  assert.equal(
    needsFieldInitialization(definitions, {
      title: 'Saved',
      rows: [{ body: '<p>Saved</p>' }],
    }),
    false,
  );
  assert.equal(needsFieldInitialization(definitions, { rows: [] }), false);
  assert.equal(needsFieldInitialization(definitions, { rows: false }), false);
  assert.equal(needsFieldInitialization(definitions, { rows: null }), false);
  assert.equal(
    needsFieldInitialization([{ type: 'code', id: 'example' }]),
    false,
  );
});

test('legacy missing rows, code assets and custom fields retain initialization', () => {
  assert.equal(
    needsFieldInitialization([{ type: 'repeater', id: 'rows', min: 1 }]),
    true,
  );
  assert.equal(
    needsFieldInitialization([
      { type: 'repeater', id: 'rows', default: [{ title: 'Default' }] },
    ]),
    true,
  );
  assert.equal(needsFieldInitialization([{ type: 'code', asset: true }]), true);
  assert.equal(needsFieldInitialization([{ type: 'code' }], {}, true), true);
  assert.equal(needsFieldInitialization([{ type: 'example/custom' }]), true);
});

test('initialization walks all tabs, prefixed groups and nested stored rows without changing them', () => {
  const definitions = [
    {
      type: 'tabs',
      tabs: [
        { attributes: [{ type: 'text', id: 'text' }] },
        {
          attributes: [
            {
              type: 'group',
              id: 'group',
              attributes: [
                {
                  type: 'repeater',
                  id: 'rows',
                  min: 1,
                  attributes: [{ type: 'code', id: 'style', asset: true }],
                },
              ],
            },
          ],
        },
      ],
    },
  ];
  const values = { group_rows: [{ style: 'body { color: red; }' }] };
  const snapshot = JSON.stringify(values);
  assert.equal(needsFieldInitialization(definitions, values), true);
  assert.equal(
    needsFieldInitialization(definitions, { group_rows: [] }),
    false,
  );
  assert.equal(JSON.stringify(values), snapshot);
});
