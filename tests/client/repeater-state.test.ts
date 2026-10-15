import assert from 'node:assert/strict';
import { afterEach, beforeEach, test } from 'node:test';
import {
  readRepeaterState,
  writeRepeaterState,
} from '../../src/blocks/utils/repeater-state';

let values: Map<string, string>;
const original = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');

beforeEach(() => {
  values = new Map();
  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true,
    value: {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => values.set(key, value),
    },
  });
});

afterEach(() => {
  if (original) Object.defineProperty(globalThis, 'localStorage', original);
  else Reflect.deleteProperty(globalThis, 'localStorage');
});

test('expanded exceptions preserve other rows and remain separate from legacy state', () => {
  writeRepeaterState('blockstudioRepeater', 'legacy', true, false);
  writeRepeaterState('blockstudioRepeaterExpanded', 'first', false, true);
  writeRepeaterState('blockstudioRepeaterExpanded', 'second', false, true);
  assert.deepEqual(readRepeaterState('blockstudioRepeaterExpanded'), [
    'first',
    'second',
  ]);
  writeRepeaterState('blockstudioRepeaterExpanded', 'first', true, true);
  assert.deepEqual(readRepeaterState('blockstudioRepeaterExpanded'), [
    'second',
  ]);
  assert.deepEqual(readRepeaterState('blockstudioRepeater'), ['legacy']);
});

test('repeated writes do not duplicate rows', () => {
  writeRepeaterState('rows', 'first', false, true);
  writeRepeaterState('rows', 'first', false, true);
  assert.deepEqual(readRepeaterState('rows'), ['first']);
});

test('malformed and unavailable storage cannot break field rendering', () => {
  for (const value of ['bad JSON', '{}', 'null', 'true']) {
    values.set('rows', value);
    assert.deepEqual(readRepeaterState('rows'), []);
    assert.doesNotThrow(() => writeRepeaterState('rows', 'first', false, true));
  }
  values.set('rows', '["first", null, 42]');
  assert.deepEqual(readRepeaterState('rows'), ['first']);
  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true,
    get: () => {
      throw new Error('Storage denied');
    },
  });
  assert.deepEqual(readRepeaterState('rows'), []);
  assert.doesNotThrow(() => writeRepeaterState('rows', 'first', true, false));
});
