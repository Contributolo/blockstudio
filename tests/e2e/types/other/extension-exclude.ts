import { test, expect } from '@playwright/test';
import { login, getEditorCanvas } from '../../utils/playwright-utils';

test('excluded blocks receive neither extension fields nor frontend attributes', async ({
  page,
}) => {
  await login(page);
  const nonce = await (
    await page.request.get('/wp-admin/admin-ajax.php?action=rest-nonce')
  ).text();
  const headers = { 'X-WP-Nonce': nonce };
  const attributes = JSON.stringify({
    blockstudio: { attributes: { exclusionFixture: 'present' } },
  });
  const response = await page.request.post('/wp-json/wp/v2/pages', {
    headers,
    data: {
      title: 'Extension exclusions',
      status: 'publish',
      content: `<!-- wp:separator ${attributes} --><hr class="wp-block-separator has-alpha-channel-opacity"/><!-- /wp:separator --><!-- wp:spacer ${attributes} --><div style="height:100px" aria-hidden="true" class="wp-block-spacer"></div><!-- /wp:spacer -->`,
    },
  });
  expect(response.status()).toBe(201);
  const post = await response.json();
  try {
    await page.goto(post.link);
    await expect(page.locator('.wp-block-separator')).toHaveAttribute(
      'data-exclusion-fixture',
      'present',
    );
    await expect(page.locator('.wp-block-spacer')).not.toHaveAttribute(
      'data-exclusion-fixture',
    );
    await page.goto(`/wp-admin/post.php?post=${post.id}&action=edit`);
    const canvas = await getEditorCanvas(page);
    await page.evaluate(() =>
      (window as any).wp.data
        .dispatch('core/preferences')
        .set('core/edit-post', 'welcomeGuide', false),
    );
    await canvas.locator('[data-type="core/separator"]').click();
    await expect(
      page.locator('[data-id="exclusionFixture"]:visible'),
    ).toHaveCount(1);
    await canvas.locator('[data-type="core/spacer"]').click();
    await expect(
      page.locator('[data-id="exclusionFixture"]:visible'),
    ).toHaveCount(0);
  } finally {
    await page.request.delete(`/wp-json/wp/v2/pages/${post.id}?force=true`, {
      headers,
    });
  }
});
