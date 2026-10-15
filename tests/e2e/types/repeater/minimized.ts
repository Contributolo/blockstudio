import { expect, test, Page } from '@playwright/test';
import {
  getSharedPage,
  getEditorCanvas,
  resetPageState,
  addBlock,
  openSidebar,
  saveAndReload,
  count,
} from '../../utils/playwright-utils';

let page: Page;

const row = (index: number) =>
  page.locator(`[data-rfd-draggable-id="items[${index}]"]`);
const rowInput = (index: number) =>
  row(index).locator('.blockstudio-fields__field--text input').first();

test.describe.configure({ mode: 'serial' });

test.beforeAll(async ({ browser }) => {
  page = await getSharedPage(browser);
  await resetPageState(page);
  await page.evaluate(() => window.localStorage.clear());
});

test.describe('repeater minimized', () => {
  test('insert block', async () => {
    await addBlock(page, 'type-repeater-minimized');
    const canvas = await getEditorCanvas(page);
    await count(canvas, '.is-root-container > .wp-block', 1);
  });

  test('existing rows start collapsed', async () => {
    await openSidebar(page);
    await count(page, '[data-rfd-draggable-id^="items["]', 2);
    await expect(row(0).getByText('Collapsed: First')).toBeVisible();
    await expect(row(1).getByText('Collapsed: Second')).toBeVisible();
    await expect(rowInput(0)).toBeHidden();
    await expect(rowInput(1)).toBeHidden();
  });

  test('an added row starts expanded', async () => {
    await page.click('text=Add item');
    await count(page, '[data-rfd-draggable-id^="items["]', 3);
    await expect(rowInput(2)).toBeVisible();
  });

  test('an expanded row stays expanded after a reload', async () => {
    await row(0).locator('.blockstudio-repeater__minimize').first().click();
    await expect(rowInput(0)).toBeVisible();
    await saveAndReload(page);
    const canvas = await getEditorCanvas(page);
    await canvas.locator('.is-root-container > .wp-block').first().click();
    await openSidebar(page);
    await expect(rowInput(0)).toBeVisible();
    await expect(rowInput(1)).toBeHidden();
  });

  test('clean up', async () => {
    await page.evaluate(() => window.localStorage.clear());
    await resetPageState(page);
  });
});
