import { test, expect } from '@playwright/test';

test.describe('bsui/toggle', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/toggle-test/');
    await page.waitForSelector('[aria-pressed]');
  });

  test('renders toggle instances', async ({ page }) => {
    await expect(page.locator('[aria-pressed]')).toHaveCount(3);
  });

  test('default toggle has aria-pressed=false', async ({ page }) => {
    const tg = page.locator('[aria-pressed]').first();
    await expect(tg).toHaveAttribute('aria-pressed', 'false');
  });

  test('pressed toggle has aria-pressed=true', async ({ page }) => {
    const tg = page.locator('[aria-pressed]').nth(1);
    await expect(tg).toHaveAttribute('aria-pressed', 'true');
  });

  test('disabled toggle does not respond', async ({ page }) => {
    const tg = page.locator('[aria-pressed]').nth(2);
    await expect(tg).toBeDisabled();
  });

  test('toggle has label text', async ({ page }) => {
    const label = page.locator('[data-bsui-toggle]').first().locator('span');
    await expect(label).toBeVisible();
  });

  test('uncontrolled toggles change by pointer and keyboard without submitting forms', async ({
    page,
  }) => {
    const toggle = page.getByRole('button', {
      name: 'Default Toggle',
      exact: true,
    });
    await expect(toggle).toHaveAttribute('type', 'button');
    await toggle.click();
    await expect(toggle).toHaveAttribute('aria-pressed', 'true');
    await page.keyboard.press('Space');
    await expect(toggle).toHaveAttribute('aria-pressed', 'false');
    await page.keyboard.press('Enter');
    await expect(toggle).toHaveAttribute('aria-pressed', 'true');
    const pressed = page.getByRole('button', {
      name: 'Pressed Toggle',
      exact: true,
    });
    await pressed.click();
    await expect(pressed).toHaveAttribute('aria-pressed', 'false');
  });
});
