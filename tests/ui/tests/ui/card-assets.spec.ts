import { test, expect } from '@playwright/test';

test('a card-only page closes its text dependency without a text block', async ({
  page,
}) => {
  await page.goto('/card-assets-test/');
  const title = page.locator('[data-bsui-card-title]');
  const description = page.locator('[data-bsui-card-description]');
  await expect(title).toHaveCSS('font-size', '18px');
  await expect(title).toHaveCSS('font-weight', '600');
  await expect(description).toHaveCSS('font-size', '14px');
  const colors = await page.evaluate(() => ({
    title: getComputedStyle(document.querySelector('[data-bsui-card-title]')!)
      .color,
    description: getComputedStyle(
      document.querySelector('[data-bsui-card-description]')!,
    ).color,
  }));
  expect(colors.description).not.toBe(colors.title);
  await expect(
    page.locator('#blockstudio-bsui-text-style-inline-css'),
  ).toHaveCount(1);
});
