import { test, expect, type Page, type Locator } from '@playwright/test';

async function expectPopupInViewport(page: Page, listbox: Locator) {
  await expect(async () => {
    const box = await listbox.boundingBox();
    const viewport = page.viewportSize();
    expect(box).not.toBeNull();
    expect(viewport).not.toBeNull();
    expect(box!.x).toBeGreaterThanOrEqual(7.5);
    expect(box!.x + box!.width).toBeLessThanOrEqual(viewport!.width - 7.5);
    expect(box!.y).toBeGreaterThanOrEqual(7.5);
    expect(box!.y + box!.height).toBeLessThanOrEqual(viewport!.height - 7.5);
    const overflow = await listbox.evaluate(
      (element) => element.scrollWidth - element.clientWidth,
    );
    expect(overflow).toBeLessThanOrEqual(1);
  }).toPass({ timeout: 4000 });
}

for (const width of [320, 390]) {
  for (const reducedMotion of ['no-preference', 'reduce'] as const) {
    test.describe(`${width}px ${reducedMotion}`, () => {
      test.use({
        viewport: { width, height: 900 },
        contextOptions: { reducedMotion },
      });

      for (const name of ['selected', 'plain', 'multiple']) {
        test(`${name} select sizes before positioning and stays usable`, async ({
          page,
        }, testInfo) => {
          await page.goto('/select-viewport-test/');
          const root = page.locator(
            `[data-bsui-select-root]:has(input[name="${name}"])`,
          );
          const trigger = root.locator('[data-bsui-select-trigger]');
          const listbox = root.locator('[role="listbox"]');
          await trigger.focus();
          await page.keyboard.press('ArrowDown');
          await expect(listbox).toBeVisible();
          await expectPopupInViewport(page, listbox);

          if (name === 'selected') {
            await expect(async () => {
              const triggerBox = await trigger.boundingBox();
              const selected = await root
                .locator('[aria-selected="true"]')
                .boundingBox();
              expect(selected!.y).toBeCloseTo(triggerBox!.y, 0);
            }).toPass({ timeout: 4000 });
          }

          await page.evaluate(() => window.scrollBy(0, 80));
          await expectPopupInViewport(page, listbox);
          await page.screenshot({ path: testInfo.outputPath('open.png') });
          await page.keyboard.press('Escape');
          await expect(listbox).toBeHidden();
          await expect(trigger).toBeFocused();

          await trigger.click();
          await expect(listbox).toBeVisible();
          await root.locator('[role="option"][data-value="grape"]').click();
          if (name === 'multiple') {
            await expect(listbox).toBeVisible();
            await expect(root.locator('[data-value="grape"]')).toHaveAttribute(
              'aria-selected',
              'true',
            );
            await page.keyboard.press('Escape');
          } else {
            await expect(listbox).toBeHidden();
            await expect(root.locator('input[type="hidden"]')).toHaveValue(
              'grape',
            );
            await expect(trigger).toContainText('Grape');
          }
          await expect(trigger).toBeFocused();
        });
      }
    });
  }
}
