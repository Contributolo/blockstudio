import { expect, Page, test } from '@playwright/test';
import {
  addBlock,
  getEditorCanvas,
  getSharedPage,
  openSidebar,
  resetPageState,
  saveAndReload,
} from '../../utils/playwright-utils';

let page: Page;
const nativeDialogs: string[] = [];
const recordDialog = (dialog: { type: () => string }) =>
  nativeDialogs.push(dialog.type());
const row = (path: string) => page.locator(`[data-rfd-draggable-id="${path}"]`);
const remove = (path: string) =>
  row(path).locator(':scope > div > .blockstudio-repeater__remove');
const values = () =>
  page.evaluate(
    () =>
      (window as any).wp.data.select('core/block-editor').getBlocks()[0]
        .attributes.blockstudio.attributes,
  );

test.describe.configure({ mode: 'serial' });

test.beforeAll(async ({ browser }) => {
  page = await getSharedPage(browser);
  await resetPageState(page);
  page.on('dialog', recordDialog);
  await addBlock(page, 'type-repeater-confirmation');
  await openSidebar(page);
});

test.afterAll(async () => {
  page.off('dialog', recordDialog);
  await resetPageState(page);
});

test('custom confirmation text, cancellation and modal keys preserve the row data', async () => {
  await expect(row('custom[1]')).toBeVisible();
  const before = await values();
  const trigger = remove('custom[1]');
  await trigger.click();
  const dialog = page.getByRole('dialog', {
    name: 'Remove row 2',
    exact: true,
  });
  await expect(dialog).toContainText('Remove this entry?');
  await expect(
    dialog.getByRole('button', { name: 'Delete', exact: true }),
  ).toBeVisible();
  await page.keyboard.press('ArrowDown');
  expect(await values()).toEqual(before);
  await dialog.getByRole('button', { name: 'Cancel', exact: true }).click();
  await expect(dialog).toHaveCount(0);
  await expect(trigger).toBeFocused();
  expect(await values()).toEqual(before);
});

test('confirming deletes only the requested row and keeps the minimum-row gate', async () => {
  await remove('custom[1]').click();
  await page
    .getByRole('dialog')
    .getByRole('button', { name: 'Delete', exact: true })
    .click();
  await expect(row('custom[1]')).toHaveCount(0);
  await expect(remove('custom[0]')).toHaveCount(0);
  const stored = await values();
  expect(stored.custom).toEqual([{ title: 'Keep custom' }]);
  expect(stored.silent).toHaveLength(2);
  expect(stored.nested).toHaveLength(2);
});

test('textRemove false removes immediately without opening either kind of dialog', async () => {
  await remove('silent[1]').click();
  await expect(row('silent[1]')).toHaveCount(0);
  await expect(page.getByRole('dialog')).toHaveCount(0);
  expect((await values()).silent).toEqual([{ title: 'Keep silent' }]);
  expect(nativeDialogs).toEqual([]);
});

test('an empty confirmation string uses the default question and Escape cancels it', async () => {
  const trigger = remove('empty[1]');
  await trigger.click();
  const dialog = page.getByRole('dialog', {
    name: 'Remove row 2',
    exact: true,
  });
  await expect(dialog).toContainText('Do you want to delete this row?');
  await page.keyboard.press('Escape');
  await expect(dialog).toHaveCount(0);
  await expect(trigger).toBeFocused();
  expect((await values()).empty).toHaveLength(2);
});

test('nested confirmation removes only its own nested row', async () => {
  const before = await values();
  await remove('nested[0].items[1]').click();
  const dialog = page.getByRole('dialog', {
    name: 'Remove row 2',
    exact: true,
  });
  await expect(dialog).toContainText('Remove nested entry?');
  await page.keyboard.press('ArrowDown');
  expect(await values()).toEqual(before);
  await dialog.getByRole('button', { name: 'Delete', exact: true }).click();
  await expect(row('nested[0].items[1]')).toHaveCount(0);
  expect((await values()).nested).toEqual([
    { items: [{ title: 'Keep nested' }] },
    { items: [{ title: 'Other parent' }] },
  ]);
});

test('confirmed deletions persist after saving without native browser dialogs', async () => {
  const stored = await values();
  await saveAndReload(page);
  const canvas = await getEditorCanvas(page);
  await canvas.locator('.repeater-confirmation').click();
  await openSidebar(page);
  expect(await values()).toEqual(stored);
  await expect(canvas.locator('.repeater-confirmation code')).not.toContainText(
    'Delete custom',
  );
  await expect(canvas.locator('.repeater-confirmation code')).not.toContainText(
    'Delete silent',
  );
  await expect(canvas.locator('.repeater-confirmation code')).not.toContainText(
    'Delete nested',
  );
  await expect(canvas.locator('.repeater-confirmation code')).toContainText(
    'Other parent',
  );
  expect(nativeDialogs).toEqual([]);
});
