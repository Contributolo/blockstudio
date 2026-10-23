import { expect, test } from '@playwright/test';

test('small external stylesheets can inline without changing applied styles and stay linked by default', async ({
  page,
}) => {
  const id = 'blockstudio-blockstudio-init-global-style-css';
  const url = 'http://localhost:8888/native-single/';
  expect((await page.goto(url))?.status()).toBe(200);
  await expect(page.locator(`link#${id}`)).toHaveCount(1);
  await expect(page.locator(`style#${id}`)).toHaveCount(0);
  const background = await page
    .locator('body')
    .evaluate((body) => getComputedStyle(body).backgroundColor);

  await page.setExtraHTTPHeaders({
    'X-Blockstudio-Test-Inline-Limit': '40000',
  });
  expect((await page.goto(url))?.status()).toBe(200);
  await expect(page.locator(`style#${id}`)).toHaveCount(1);
  await expect(page.locator(`link#${id}`)).toHaveCount(0);
  await expect(page.locator(`style#${id}`)).toContainText('background');
  expect(
    await page
      .locator('body')
      .evaluate((body) => getComputedStyle(body).backgroundColor),
  ).toBe(background);

  await page.setExtraHTTPHeaders({ 'X-Blockstudio-Test-Inline-Limit': '0' });
  expect((await page.goto(url))?.status()).toBe(200);
  await expect(page.locator(`link#${id}`)).toHaveCount(1);
  await expect(page.locator(`style#${id}`)).toHaveCount(0);
});
