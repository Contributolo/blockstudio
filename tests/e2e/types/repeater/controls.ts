import { expect, test, Page } from '@playwright/test';
import {
  getSharedPage,
  getEditorCanvas,
  resetPageState,
  addBlock,
  openSidebar,
  count,
} from '../../utils/playwright-utils';

let page: Page;

const rows = () => page.locator('[data-rfd-draggable-id^="items["]');
const row = (index: number) =>
  page.locator(`[data-rfd-draggable-id="items[${index}]"]`);
const rowInput = (index: number) =>
  row(index).locator('.blockstudio-fields__field--text input').first();
const control = (index: number, name: string) =>
  row(index).getByRole('button', { name, exact: true });

test.describe.configure({ mode: 'serial' });

test.beforeAll(async ({ browser }) => {
  page = await getSharedPage(browser);
  await resetPageState(page);
  await page.evaluate(() => {
    window.localStorage.removeItem('blockstudioRepeater');
    window.localStorage.removeItem('blockstudioRepeaterExpanded');
  });
});

test.describe('repeater row controls', () => {
  test('insert block', async () => {
    await addBlock(page, 'type-repeater-default-rows');
    const canvas = await getEditorCanvas(page);
    await count(canvas, '.is-root-container > .wp-block', 1);
    await openSidebar(page);
    await expect(rows()).toHaveCount(2);
  });

  test('every row control has an accessible name with the row number', async () => {
    for (const index of [0, 1]) {
      const number = index + 1;
      await expect(control(index, `Collapse row ${number}`)).toHaveCount(1);
      await expect(control(index, `Duplicate row ${number}`)).toHaveCount(1);
      await expect(control(index, `Remove row ${number}`)).toHaveCount(1);
    }
  });

  test('collapse and expand with Enter and Space', async () => {
    const collapse = control(0, 'Collapse row 1');
    await expect(collapse).toHaveAttribute('aria-expanded', 'true');
    await collapse.focus();
    await page.keyboard.press('Enter');
    await expect(rowInput(0)).toBeHidden();

    const expand = control(0, 'Expand row 1');
    await expect(expand).toBeFocused();
    await expect(expand).toHaveAttribute('aria-expanded', 'false');
    await page.keyboard.press('Space');
    await expect(rowInput(0)).toBeVisible();
    await expect(control(0, 'Collapse row 1')).toBeFocused();
    await expect(rows()).toHaveCount(2);
  });

  test('duplicate with Enter', async () => {
    await control(0, 'Duplicate row 1').focus();
    await page.keyboard.press('Enter');
    await expect(rows()).toHaveCount(3);
    await expect(control(2, 'Remove row 3')).toHaveCount(1);
  });

  test('remove with Space after the confirmation', async () => {
    await control(2, 'Remove row 3').focus();
    const dialog = page.waitForEvent('dialog');
    const press = page.keyboard.press('Space');
    expect((await dialog).message()).toBe('Do you want to delete this row?');
    await press;
    await expect(rows()).toHaveCount(2);
  });

  test('remove with Enter', async () => {
    await control(1, 'Remove row 2').focus();
    const dialog = page.waitForEvent('dialog');
    const press = page.keyboard.press('Enter');
    await dialog;
    await press;
    await expect(rows()).toHaveCount(1);
    await expect(control(0, 'Remove row 1')).toHaveCount(1);
  });

  test('clean up', async () => {
    await page.evaluate(() => {
      window.localStorage.removeItem('blockstudioRepeater');
      window.localStorage.removeItem('blockstudioRepeaterExpanded');
    });
    await resetPageState(page);
  });
});
