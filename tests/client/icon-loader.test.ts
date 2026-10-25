import assert from 'node:assert/strict';
import test from 'node:test';
import { createIconSetLoader } from '../../src/blocks/utils/icon-loader';

test('icon sets stay lazy and simultaneous requests share one request', async () => {
  const requests: string[] = [];
  const load = createIconSetLoader(async (path) => {
    requests.push(path);
    return { 'heart.svg': '<svg/>' };
  });
  assert.deepEqual(requests, []);
  const first = load('fontawesome-free', 'solid');
  assert.equal(first, load('fontawesome-free', 'solid'));
  assert.deepEqual(await first, { 'heart.svg': '<svg/>' });
  assert.deepEqual(requests, [
    '/blockstudio/v1/icons?set=fontawesome-free&subSet=solid',
  ]);
});

test('failed icon requests can retry and subsets stay isolated', async () => {
  let calls = 0;
  const load = createIconSetLoader(async (path) => {
    if (++calls === 1) throw new Error('Temporary failure');
    return { 'loaded.svg': path };
  });
  await assert.rejects(load('tabler-icons', 'outline'), /Temporary failure/);
  const [outline, filled] = await Promise.all([
    load('tabler-icons', 'outline'),
    load('tabler-icons', 'filled'),
  ]);
  assert.match(outline['loaded.svg'], /subSet=outline/);
  assert.match(filled['loaded.svg'], /subSet=filled/);
  assert.equal(calls, 3);
});

test('unknown and inherited-object icon set names never make requests', async () => {
  const load = createIconSetLoader(async () => {
    throw new Error('Unexpected request');
  });
  await assert.rejects(load('unknown-set'), /Unknown icon set/);
  await assert.rejects(load('toString'), /Unknown icon set/);
});
