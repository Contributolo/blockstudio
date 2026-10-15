import assert from 'node:assert/strict';
import { test } from 'node:test';
import { joinListValues } from '../../src/blocks/utils/join-list-values';

test('list values are separated with a space', () => {
  assert.equal(joinListValues(['en-au', 'de', 'fr']), 'en-au de fr');
});

test('empty and repeated list values are skipped', () => {
  assert.equal(joinListValues(['', 'en', ' ', null, 'de', 'en']), 'en de');
});

test('list values are trimmed and numbers are kept', () => {
  assert.equal(joinListValues([' en ', 2, 1.5]), 'en 2 1.5');
});

test('list values that are not text are skipped', () => {
  assert.equal(
    joinListValues([{ value: 'de' }, true, 'en', false, undefined]),
    'en',
  );
});

test('an empty list joins to an empty string', () => {
  assert.equal(joinListValues([]), '');
});
