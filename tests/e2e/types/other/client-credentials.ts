import { test, expect } from '@playwright/test';
import { login } from '../../utils/playwright-utils';

test('anonymous RPC and database clients share fresh uncached credentials', async ({
  page,
}) => {
  const refreshes: string[] = [];
  page.on('request', (request) => {
    if (request.url().includes('/client/credentials'))
      refreshes.push(request.url());
  });
  const response = page.waitForResponse((response) =>
    response.url().includes('/client/credentials'),
  );
  await page.goto('/native-single/');
  const result = await page.evaluate(async () => {
    const bs = (window as any).bs;
    return Promise.all([
      bs.fn('public', { value: 'fresh' }, 'blockstudio/type-functions'),
      bs.db('blockstudio/type-db-table').list(),
    ]);
  });
  expect(result[0]).toEqual({ public: true, echo: 'fresh' });
  expect((await response).headers()['cache-control']).toContain('no-store');
  expect(Array.isArray(result[1])).toBe(true);
  expect(refreshes).toHaveLength(1);
});

test('stale cached credentials are rejected by WordPress then refreshed without relaxing authorization', async ({
  page,
}) => {
  let refreshes = 0;
  let attempts = 0;
  await page.route(
    '**/wp-json/blockstudio/v1/client/credentials',
    async (route) => {
      const response = await route.fetch();
      const credentials = await response.json();
      refreshes++;
      if (refreshes === 1) credentials.nonce = 'expired-page-cache-nonce';
      await route.fulfill({ response, json: credentials });
    },
  );
  await page.route(
    '**/wp-json/blockstudio/v1/fn/blockstudio/type-functions/public',
    async (route) => {
      attempts++;
      await route.continue();
    },
  );
  await page.goto('/native-single/');
  const result = await page.evaluate(async () =>
    (window as any).bs.fn(
      'public',
      { value: 'retried' },
      'blockstudio/type-functions',
    ),
  );
  expect(result).toEqual({ public: true, echo: 'retried' });
  expect(attempts).toBe(2);
  expect(refreshes).toBe(2);
  const denied = await page.evaluate(async () =>
    (window as any).bs.fn('greet', {}, 'blockstudio/type-functions'),
  );
  expect(denied.code).toBeTruthy();
  expect(denied.message).not.toBe('Hello, World!');
});

test('database calls recover when a cached CSRF token is rejected by the real endpoint', async ({
  page,
}) => {
  let refreshes = 0;
  await page.route(
    '**/wp-json/blockstudio/v1/client/credentials',
    async (route) => {
      const response = await route.fetch();
      const credentials = await response.json();
      refreshes++;
      if (refreshes === 1) credentials.token = 'expired-page-cache-token';
      await route.fulfill({ response, json: credentials });
    },
  );
  await page.goto('/native-single/');
  const rows = await page.evaluate(async () =>
    (window as any).bs.db('blockstudio/type-db-table').list(),
  );
  expect(Array.isArray(rows)).toBe(true);
  expect(refreshes).toBe(2);
});

test('fresh credentials preserve the visiting authenticated session', async ({
  page,
}) => {
  await login(page);
  await page.goto('/native-single/');
  const result = await page.evaluate(async () =>
    (window as any).bs.fn(
      'greet',
      { name: 'Session' },
      'blockstudio/type-functions',
    ),
  );
  expect(result).toEqual({ message: 'Hello, Session!' });
});

test('credential endpoint rejects simple and cross-origin requests', async ({
  request,
}) => {
  const url = '/wp-json/blockstudio/v1/client/credentials';
  expect((await request.post(url)).status()).toBe(403);
  expect(
    (
      await request.post(url, {
        headers: { 'X-BS-Credentials': '1', Origin: 'https://evil.example' },
      })
    ).status(),
  ).toBe(403);
  expect(
    (
      await request.post(url, {
        headers: { 'X-BS-Credentials': '1', 'Sec-Fetch-Site': 'same-site' },
      })
    ).status(),
  ).toBe(403);
  expect((await request.get(url)).status()).toBe(404);
});
