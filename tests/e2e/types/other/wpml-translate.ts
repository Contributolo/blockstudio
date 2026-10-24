import { test, expect } from '@playwright/test';
import { login, getEditorCanvas } from '../../utils/playwright-utils';

test('WPML opt-out fields remain editable and preserve their stored values', async ({
  page,
}) => {
  await login(page);
  const nonce = await (
    await page.request.get('/wp-admin/admin-ajax.php?action=rest-nonce')
  ).text();
  const headers = { 'X-WP-Nonce': nonce };
  const attributes = {
    blockstudio: { attributes: { heading: 'Welcome', account: 'original' } },
  };
  const response = await page.request.post('/wp-json/wp/v2/pages', {
    headers,
    data: {
      title: 'WPML field opt-out',
      status: 'publish',
      content: `<!-- wp:blockstudio/test-wpml-translate ${JSON.stringify(attributes)} /-->`,
    },
  });
  expect(response.status()).toBe(201);
  const post = await response.json();

  try {
    await page.goto(`/wp-admin/post.php?post=${post.id}&action=edit`);
    const canvas = await getEditorCanvas(page);
    await page.evaluate(() =>
      (window as any).wp.data
        .dispatch('core/preferences')
        .set('core/edit-post', 'welcomeGuide', false),
    );
    await canvas
      .locator('[data-type="blockstudio/test-wpml-translate"]')
      .click();
    const input = page.locator('[data-id="account"] input:visible');
    await expect(input).toHaveValue('original');
    await expect(input).not.toHaveAttribute('translate');
    await input.fill('shared-account');
    await expect(input).toHaveValue('shared-account');
    await expect
      .poll(() =>
        page.evaluate(
          () =>
            (window as any).wp.data.select('core/block-editor').getBlocks()[0]
              ?.attributes.blockstudio.attributes.account,
        ),
      )
      .toBe('shared-account');
    await page.evaluate(() =>
      (window as any).wp.data.dispatch('core/editor').savePost(),
    );
    await page.goto(post.link);
    await expect(page.locator('[data-wpml-translate]')).toContainText(
      'shared-account',
    );
    await page.goto(`/wp-admin/post.php?post=${post.id}&action=edit`);
    const reloaded = await getEditorCanvas(page);
    await reloaded
      .locator('[data-type="blockstudio/test-wpml-translate"]')
      .click();
    await expect(input).toHaveValue('shared-account');
  } finally {
    await page.request.delete(`/wp-json/wp/v2/pages/${post.id}?force=true`, {
      headers,
    });
  }
});
