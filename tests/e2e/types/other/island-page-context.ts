import { test, expect } from '@playwright/test';
import { login } from '../../utils/playwright-utils';

test('dynamic fragments retain signed page context with page-specific caching', async ({
  page,
}) => {
  await login(page);
  const nonce = await (
    await page.request.get('/wp-admin/admin-ajax.php?action=rest-nonce')
  ).text();
  const headers = { 'X-WP-Nonce': nonce };
  const posts: Array<{
    id: number;
    link: string;
    title: { rendered: string };
  }> = [];
  try {
    for (const title of ['Context first page', 'Context second page']) {
      const response = await page.request.post('/wp-json/wp/v2/pages', {
        headers,
        data: {
          title,
          status: 'publish',
          content: '<!-- wp:blockstudio/island-page-context /-->',
        },
      });
      expect(response.status()).toBe(201);
      posts.push(await response.json());
    }
    for (const post of [...posts, posts[0]]) {
      const request = page.waitForRequest((request) =>
        request.url().includes('/island/render'),
      );
      await page.goto(post.link);
      const sent = (await request).postDataJSON().islands[0];
      expect(sent.context).toEqual({ postId: post.id, postType: 'page' });
      const fragment = page.locator('.island-page-context');
      await expect(fragment).toContainText(post.title.rendered);
      for (const attribute of [
        'data-post-id',
        'data-global-id',
        'data-query-id',
      ]) {
        await expect(fragment).toHaveAttribute(attribute, String(post.id));
      }
      const forged = await page.request.post(
        '/wp-json/blockstudio/v1/island/render',
        {
          data: {
            islands: [
              {
                ...sent,
                context: {
                  postId: posts.find((other) => other.id !== post.id)!.id,
                  postType: 'page',
                },
              },
            ],
          },
        },
      );
      expect((await forged.json())[sent.clientId]).toEqual({
        error: 'blockstudio_island_invalid_signature',
      });
    }
  } finally {
    for (const post of posts)
      await page.request.delete(`/wp-json/wp/v2/pages/${post.id}?force=true`, {
        headers,
      });
  }
});
