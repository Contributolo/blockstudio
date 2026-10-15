import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  isMediaId,
  normalizeCardValues,
} from '../../src/blocks/utils/card-values';

test('single file values become one card without splitting strings', () => {
  for (const value of ['buckshair-home', '1604', 1604]) {
    assert.deepEqual(normalizeCardValues(value), [value]);
  }
});

test('empty file values produce no cards', () => {
  for (const value of [false, null, undefined, '', 0, []]) {
    assert.deepEqual(normalizeCardValues(value), []);
  }
});

test('file arrays and select option objects preserve their values and identity', () => {
  const files = ['buckshair-home', 1604, 'another-image'];
  const options = [
    { value: 'first', label: 'First' },
    { value: 'second', label: 'Second' },
  ];
  assert.equal(normalizeCardValues(files), files);
  assert.equal(normalizeCardValues(options), options);
  assert.equal(normalizeCardValues(options[0])[0], options[0]);
  assert.deepEqual(files, ['buckshair-home', 1604, 'another-image']);
});

test('only attachment IDs are eligible for media resolution', () => {
  for (const value of [1604, '1604', 1, '1']) {
    assert.equal(isMediaId(value), true);
  }
  for (const value of [
    'buckshair-home',
    '',
    '0',
    0,
    -1,
    1.5,
    '1604abc',
    'https://example.com/a.jpg',
    false,
    null,
    undefined,
    {},
    [],
  ]) {
    assert.equal(isMediaId(value), false);
  }
  assert.deepEqual(
    normalizeCardValues(['buckshair-home', 1604, '1605']).filter(isMediaId),
    [1604, '1605'],
  );
});
