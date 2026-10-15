import assert from 'node:assert/strict';
import { test } from 'node:test';
import { normalizeOptionValues } from '../../src/blocks/utils/option-values';
import type { BlockstudioFieldsOptions } from '../../src/types/types';

const languages = [
  { value: 'de', label: 'Deutsch' },
  { value: 'en', label: 'English' },
];
const numbers = [
  { value: 1, label: 'One' },
  { value: 2, label: 'Two' },
] as unknown as BlockstudioFieldsOptions[];

test('lists are returned unchanged', () => {
  const options = [languages[1], languages[0]];
  const values = ['de', 'en'];
  const empty: string[] = [];
  assert.equal(normalizeOptionValues(options, languages), options);
  assert.equal(normalizeOptionValues(values, languages), values);
  assert.equal(normalizeOptionValues(empty, languages), empty);
});

test('a single option object becomes a one item list', () => {
  const [selected] = normalizeOptionValues(languages[1], languages);
  assert.equal(selected, languages[1]);
  assert.deepEqual(normalizeOptionValues({ value: 'de' }, languages), [
    { value: 'de' },
  ]);
});

test('a plain value becomes one option labelled from the options', () => {
  assert.deepEqual(normalizeOptionValues('de', languages), [
    { value: 'de', label: 'Deutsch' },
  ]);
  assert.deepEqual(normalizeOptionValues(2, numbers), [
    { value: 2, label: 'Two' },
  ]);
  assert.deepEqual(normalizeOptionValues('2', numbers), [
    { value: 2, label: 'Two' },
  ]);
});

test('a plain value without a matching option is its own label', () => {
  assert.deepEqual(normalizeOptionValues('fr', languages), [
    { value: 'fr', label: 'fr' },
  ]);
  assert.deepEqual(normalizeOptionValues(3, numbers), [
    { value: 3, label: '3' },
  ]);
  assert.deepEqual(normalizeOptionValues('de'), [{ value: 'de', label: 'de' }]);
});

test('empty and unusable values produce no options', () => {
  for (const value of [undefined, null, false, true, '', {}]) {
    assert.deepEqual(normalizeOptionValues(value, languages), []);
  }
});
