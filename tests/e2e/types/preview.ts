import { test, expect, BrowserContext, Page } from '@playwright/test';
import {
  addBlock,
  getEditorCanvas,
  login,
  openBlockInserter,
  resetPageState,
  save,
} from '../utils/playwright-utils';

let context: BrowserContext;
let page: Page;

test.describe.configure({ mode: 'serial' });

test.beforeAll(async ({ browser }) => {
  context = await browser.newContext();
  page = await context.newPage();
  await page.setViewportSize({ width: 1920, height: 1080 });
  await login(page);
});

test.afterAll(async () => {
  await context.close();
});

test.describe('isPreview render cache', () => {
  test('place block and save', async () => {
    await resetPageState(page);
    const canvas = await getEditorCanvas(page);
    await openBlockInserter(page);
    await addBlock(page, 'type-preview');
    await expect(
      canvas.locator('[data-type="blockstudio/type-preview"]'),
    ).toHaveCount(1);
    await expect(canvas.locator('[data-preview="false"]')).toBeVisible();
    await save(page);
  });

  test('reload and verify editor renders with isPreview=false', async () => {
    await page.reload();
    const canvas = await getEditorCanvas(page);
    await expect(
      canvas.locator('[data-type="blockstudio/type-preview"]'),
    ).toHaveCount(1);
    await expect(canvas.locator('[data-preview="false"]')).toBeVisible();
  });

  test('inserter preview renders with isPreview=true', async () => {
    await openBlockInserter(page);
    await page.fill('[placeholder="Search"]', 'Preview Test');

    const inserterItem = page.locator(
      '.block-editor-block-types-list__list-item',
      { hasText: 'Preview Test' },
    );
    await expect(inserterItem).toHaveCount(1);
    await inserterItem.hover();
    await expect
      .poll(
        async () => {
          for (const frame of page.frames()) {
            if (
              await frame
                .locator('[data-preview="true"]')
                .isVisible()
                .catch(() => false)
            ) {
              return true;
            }
          }
          return false;
        },
        { timeout: 30000 },
      )
      .toBe(true);
    const canvas = await getEditorCanvas(page);
    await expect(canvas.locator('[data-preview="false"]')).toBeVisible();
  });
});
