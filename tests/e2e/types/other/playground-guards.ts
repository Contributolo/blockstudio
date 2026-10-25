import { test, expect } from '@playwright/test';

test('a mismatched Playground session cannot reset an existing test site', async ({
  request,
}) => {
  const before = await request.get('/wp-json/wp/v2/pages/1483');
  expect(before.status()).toBe(200);
  const post = await before.json();
  const reset = await request.post('/wp-json/blockstudio-test/v1/e2e/setup', {
    headers: { 'X-Blockstudio-Playground-Session': 'unrelated-instance' },
  });
  expect(reset.status()).toBe(403);
  expect((await reset.json()).code).toBe('blockstudio_playground_session');
  const after = await request.get('/wp-json/wp/v2/pages/1483');
  expect(after.status()).toBe(200);
  expect(await after.json()).toMatchObject({
    id: post.id,
    slug: post.slug,
    modified_gmt: post.modified_gmt,
  });
});
