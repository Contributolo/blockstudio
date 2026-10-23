/**
 * Seeds app databases with example data.
 *
 * Usage: node seed.ts
 * Requires: wp-env running on port 8879
 */

import { attemptPromise, main } from '../../scripts/lib/runtime.ts';

const BASE = 'http://localhost:8879/wp-json/blockstudio/v1/db';

async function request(
  url: string,
  signal: AbortSignal,
  options?: RequestInit,
) {
  const response = await fetch(url, {
    ...options,
    signal: AbortSignal.any([signal, AbortSignal.timeout(30000)]),
  });
  if (!response.ok)
    throw new Error(
      `${options?.method ?? 'GET'} ${url}: HTTP ${response.status}`,
    );
  return response;
}

async function getHeaders(signal: AbortSignal) {
  const html = await request('http://localhost:8879/', signal).then((r) =>
    r.text(),
  );
  const nonce =
    html.match(/X-WP-Nonce":"([^"]+)"/)?.[1] ||
    html.match(/wpApiSettings[^}]*"nonce":"([^"]+)"/)?.[1];
  const token =
    html.match(/bs\._token="([^"]+)"/)?.[1] ||
    html.match(/X-BS-Token":"([^"]+)"/)?.[1];

  return {
    'Content-Type': 'application/json',
    ...(nonce ? { 'X-WP-Nonce': nonce } : {}),
    ...(token ? { 'X-BS-Token': token } : {}),
  };
}

async function clearAll(
  slug: string,
  headers: Record<string, string>,
  signal: AbortSignal,
) {
  const items = await request(`${BASE}/${slug}/default`, signal, {
    headers,
  }).then((r) => r.json());
  if (!Array.isArray(items)) return;
  for (const item of items) {
    await request(`${BASE}/${slug}/default/${item.id}`, signal, {
      method: 'DELETE',
      headers,
    });
  }
}

async function create(
  slug: string,
  data: Record<string, unknown>,
  headers: Record<string, string>,
  signal: AbortSignal,
) {
  return request(`${BASE}/${slug}/default`, signal, {
    method: 'POST',
    headers,
    body: JSON.stringify(data),
  }).then((r) => r.json());
}

async function seed(signal: AbortSignal) {
  console.log('Fetching auth tokens...');
  const headers = await getHeaders(signal);

  // Todo app
  console.log('Clearing todos...');
  await clearAll('app-todo', headers, signal);

  console.log('Seeding todos...');
  const todos = [
    { text: 'Buy groceries', done: false },
    { text: 'Write documentation', done: false },
    { text: 'Review pull request', done: true },
    { text: 'Deploy to staging', done: false },
    { text: 'Fix login bug', done: true },
  ];

  for (const todo of todos) {
    const result = await create('app-todo', todo, headers, signal);
    if (result.text) {
      console.log(`  + ${result.text}${result.done ? ' (done)' : ''}`);
    } else {
      console.log('  ! Error:', JSON.stringify(result));
    }
  }

  console.log('\nDone. Visit http://localhost:8879/todo-test/');
}

if (import.meta.main) main(attemptPromise('Seed showcase', seed));
