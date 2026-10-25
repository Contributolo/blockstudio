import { expect, test } from '@playwright/test';
import { getEditorCanvas, login } from '../../utils/playwright-utils';

test('icon pickers load on interaction and recover from a failed set request', async ({
  page,
}) => {
  await login(page);
  const nonce = await (
    await page.request.get('/wp-admin/admin-ajax.php?action=rest-nonce')
  ).text();
  const headers = { 'X-WP-Nonce': nonce };
  const response = await page.request.post('/wp-json/wp/v2/pages', {
    headers,
    data: {
      title: 'Lazy icon fields',
      status: 'draft',
      content: '<!-- wp:blockstudio/type-icon /-->',
    },
  });
  expect(response.status()).toBe(201);
  const post = await response.json();
  let requests = 0;
  await page.route(/\/blockstudio\/v1\/icons\?/, async (route) => {
    if (++requests === 1) {
      await route.fulfill({
        status: 503,
        contentType: 'application/json',
        body: JSON.stringify({
          code: 'temporary_failure',
          message: 'Temporary failure',
        }),
      });
    } else await route.continue();
  });
  try {
    await page.goto(`/wp-admin/post.php?post=${post.id}&action=edit`);
    const canvas = await getEditorCanvas(page);
    await page.evaluate(() =>
      (window as any).wp.data
        .dispatch('core/preferences')
        .set('core/edit-post', 'welcomeGuide', false),
    );
    await canvas.locator('[data-type="blockstudio/type-icon"]').click();
    const input = page
      .locator('[data-id="icon"] .components-combobox-control input')
      .first();
    await expect(input).toHaveValue('alert-16');
    // Observe a quiet period after mount to catch eager network requests.
    await page.waitForTimeout(500);
    expect(requests).toBe(0);
    await input.focus();
    await expect(
      page.getByText('Unable to load icons.', { exact: true }),
    ).toBeVisible();
    expect(requests).toBe(1);
    await input.blur();
    await input.focus();
    await expect(
      page
        .locator(
          '[data-id="icon"] .components-form-token-field__suggestion svg',
        )
        .first(),
    ).toBeVisible();
    expect(requests).toBe(2);
  } finally {
    await page.request.delete(`/wp-json/wp/v2/pages/${post.id}?force=true`, {
      headers,
    });
  }
});
