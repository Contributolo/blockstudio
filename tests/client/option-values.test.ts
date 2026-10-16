import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  getNativeSelectOptions,
  getOptionLabel,
  getOptionValue,
  normalizeOptionValues,
  toggleOptionValue,
} from '../../src/blocks/utils/option-values';
import type { BlockstudioFieldsOptions } from '../../src/types/types';

const languages = [
  { value: 'de', label: 'Deutsch' },
  { value: 'en', label: 'English' },
];

test('empty native selects show a disabled placeholder without changing their options', () => {
  for (const value of [undefined, null, false, '']) {
    assert.deepEqual(getNativeSelectOptions(value, languages), [
      { value: '', label: '', disabled: true },
      ...languages,
    ]);
  }
  assert.equal(languages.length, 2);
});

test('native selects preserve an existing nullable or explicit empty option', () => {
  const options = [{ value: '', label: 'No selection' }, ...languages];
  assert.equal(getNativeSelectOptions('', options), options);
});

test('native selects do not add placeholders for stored values, including zero', () => {
  for (const value of ['de', 0, '0']) {
    assert.equal(getNativeSelectOptions(value, languages), languages);
  }
});
const numbers = [
  { value: 1, label: 'One' },
  { value: 2, label: 'Two' },
] as unknown as BlockstudioFieldsOptions[];
const zeroNumbers = [
  { value: 0, label: 'Zero' },
  { value: 1, label: 'One' },
];
const zeroStrings = [
  { value: '0', label: 'Zero' },
  { value: '1', label: 'One' },
];

// Fields passes the stored attribute, the value of the clicked option as the
// checkbox or select hands it over, and the declared options.
const click = (stored: unknown, options: unknown[], index: number) =>
  toggleOptionValue(stored, getOptionValue(options[index]), options);

test('lists of options are returned unchanged', () => {
  const options = [languages[1], languages[0]];
  const empty: string[] = [];
  assert.equal(normalizeOptionValues(options, languages), options);
  assert.equal(normalizeOptionValues(empty, languages), empty);
});

test('a list of plain values becomes a list of options', () => {
  assert.deepEqual(normalizeOptionValues(['en', 'de'], languages), [
    { value: 'en', label: 'English' },
    { value: 'de', label: 'Deutsch' },
  ]);
  assert.deepEqual(normalizeOptionValues([0, null, ''], zeroNumbers), [
    { value: 0, label: 'Zero' },
  ]);
});

test('a single option object becomes a one item list', () => {
  const [selected] = normalizeOptionValues(languages[1], languages);
  assert.equal(selected, languages[1]);
  assert.deepEqual(normalizeOptionValues({ value: 'de' }, languages), [
    { value: 'de' },
  ]);
  assert.deepEqual(normalizeOptionValues(zeroNumbers[0], zeroNumbers), [
    zeroNumbers[0],
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

test('zero is a stored value, not an empty one', () => {
  assert.deepEqual(normalizeOptionValues(0, zeroNumbers), [zeroNumbers[0]]);
  assert.deepEqual(normalizeOptionValues('0', zeroNumbers), [zeroNumbers[0]]);
  assert.deepEqual(normalizeOptionValues(0, zeroStrings), [zeroStrings[0]]);
  assert.deepEqual(normalizeOptionValues(0, [0, 1]), [
    { value: 0, label: '0' },
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
  for (const value of [undefined, null, false, true, '', {}, { value: null }]) {
    assert.deepEqual(normalizeOptionValues(value, languages), []);
  }
});

test('option values and labels keep zero and empty strings', () => {
  assert.equal(getOptionValue(zeroNumbers[0]), 0);
  assert.equal(getOptionValue({ value: '', label: 'None' }), '');
  assert.equal(getOptionValue(0), 0);
  assert.equal(getOptionLabel(zeroNumbers[0]), 'Zero');
  assert.equal(getOptionLabel(0), '0');
  assert.equal(getOptionLabel({ value: 0, label: '' }), '0');
});

test('unchecking zero after adding a second option keeps that option', () => {
  const plain = [0, 1];
  const added = click(0, plain, 1);
  assert.deepEqual(added, [
    { value: 0, label: '0' },
    { value: 1, label: '1' },
  ]);
  assert.deepEqual(click(added, plain, 0), [{ value: 1, label: '1' }]);

  const fromObject = click(zeroNumbers[0], zeroNumbers, 1);
  assert.deepEqual(fromObject, zeroNumbers);
  assert.deepEqual(click(fromObject, zeroNumbers, 0), [zeroNumbers[1]]);

  const fromScalar = click(0, zeroNumbers, 1);
  assert.deepEqual(fromScalar, zeroNumbers);
  assert.deepEqual(click(fromScalar, zeroNumbers, 0), [zeroNumbers[1]]);
});

test('string options "0" and "1" add and remove the same way', () => {
  for (const stored of ['0', zeroStrings[0], [zeroStrings[0]]]) {
    const added = click(stored, zeroStrings, 1);
    assert.deepEqual(added, zeroStrings);
    assert.deepEqual(click(added, zeroStrings, 0), [zeroStrings[1]]);
    assert.deepEqual(click(added, zeroStrings, 1), [zeroStrings[0]]);
  }
});

test('removing an option keeps its siblings', () => {
  const stored = [zeroNumbers[1], zeroNumbers[0]];
  assert.deepEqual(click(stored, zeroNumbers, 1), [zeroNumbers[0]]);
  assert.deepEqual(click(stored, zeroNumbers, 0), [zeroNumbers[1]]);
  assert.deepEqual(click([{ value: '1', label: 'One' }], zeroNumbers, 1), []);
});

test('empty string, false and NaN-like option values toggle', () => {
  const options = [
    { value: '', label: 'None' },
    { value: false, label: 'No' },
    { value: 'NaN', label: 'Not a number' },
  ];
  for (const index of [0, 1, 2]) {
    const added = click([], options, index);
    assert.deepEqual(added, [options[index]]);
    assert.deepEqual(click(added, options, index), []);
  }
});

test('a missing value still clears the selection', () => {
  assert.deepEqual(toggleOptionValue(zeroNumbers, undefined, zeroNumbers), []);
  assert.deepEqual(toggleOptionValue(zeroNumbers, null, zeroNumbers), []);
});
