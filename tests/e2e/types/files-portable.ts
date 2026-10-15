import { expect, Frame, Locator, Page, test } from '@playwright/test';
import {
  getEditorCanvas,
  getSharedPage,
  openSidebar,
  resetPageState,
  saveAndReload,
} from '../utils/playwright-utils';

let page: Page;
let canvas: Frame;
let clientId: string;

const initial = {
  image: 'buckshair-home',
  shots: ['first-image', 'second-image', 'third-image'],
  items: [{ image: 'row-first' }, { image: 'row-second' }],
};

const field = (index: number) =>
  page.locator('.blockstudio-fields__field--files').nth(index);

const values = () =>
  page.evaluate(
    (id) =>
      (window as any).wp.data.select('core/block-editor').getBlockAttributes(id)
        .blockstudio.attributes,
    clientId,
  );

const remove = async (field: Locator, index = 0) => {
  const button = field
    .locator('.blockstudio-fields__field--files-toggle')
    .nth(index);
  await button.hover();
  await button.click();
};

test.beforeEach(async ({ browser }) => {
  page = await getSharedPage(browser);
  await resetPageState(page);
  canvas = await getEditorCanvas(page);
  clientId = await page.evaluate((attributes) => {
    const wp = (window as any).wp;
    const block = wp.blocks.createBlock('blockstudio/type-files-portable', {
      blockstudio: { attributes },
    });
    wp.data.dispatch('core/block-editor').resetBlocks([block]);
    return block.clientId;
  }, initial);
  await expect(canvas.locator('.portable-files')).toHaveCount(1);
  await canvas.locator('.portable-files').click();
  await openSidebar(page);
  await expect(field(3)).toContainText('row-second');
});

test('scalar strings in single fields and repeater rows survive rendering and save/reload', async () => {
  await expect(field(0)).toContainText('buckshair-home');
  await expect(field(2)).toContainText('row-first');
  await expect(
    page.locator('.blockstudio-fields__field--files .components-spinner'),
  ).toHaveCount(0);
  expect(await values()).toEqual(initial);
  await expect(canvas.locator('.portable-files code')).toContainText(
    '"image":"buckshair-home"',
  );
  await saveAndReload(page);
  canvas = await getEditorCanvas(page);
  clientId = await page.evaluate(
    () =>
      (window as any).wp.data.select('core/block-editor').getBlocks()[0]
        .clientId,
  );
  await canvas.locator('.portable-files').click();
  await openSidebar(page);
  await expect(field(2)).toContainText('row-first');
  expect(await values()).toEqual(initial);
  await expect(
    canvas.getByText('This block has encountered an error'),
  ).toHaveCount(0);
});

test('removing one fallback card preserves other values and repeater rows', async () => {
  await remove(field(1), 1);
  await expect
    .poll(values)
    .toEqual({ ...initial, shots: ['first-image', 'third-image'] });
  await remove(field(2));
  await expect.poll(values).toEqual({
    ...initial,
    shots: ['first-image', 'third-image'],
    items: [{ image: false }, { image: 'row-second' }],
  });
  await remove(field(0));
  await expect.poll(async () => (await values()).image).toBe(false);
  await expect(canvas.locator('.portable-files')).toHaveCount(1);
});

test('keyboard ordering keeps whole portable values instead of string characters', async () => {
  const first = field(1).locator(
    '[data-rfd-drag-handle-draggable-id="first-image"]',
  );
  await first.focus();
  await page.keyboard.press('ArrowDown');
  await expect
    .poll(async () => (await values()).shots)
    .toEqual(['second-image', 'first-image', 'third-image']);
  await first.focus();
  await page.keyboard.press('ArrowUp');
  await expect.poll(values).toEqual(initial);
});

test('mixed attachment IDs and portable names have thumbnails or usable fallback cards', async () => {
  await page.evaluate((id) => {
    const wp = (window as any).wp;
    const blockstudio = wp.data
      .select('core/block-editor')
      .getBlockAttributes(id).blockstudio;
    wp.data.dispatch('core/block-editor').updateBlockAttributes(id, {
      blockstudio: {
        ...blockstudio,
        attributes: {
          ...blockstudio.attributes,
          image: '1604',
          shots: [1604, 'portable-name', '1605'],
        },
      },
    });
  }, clientId);
  await expect(field(0).locator('img')).toHaveCount(1);
  await expect(field(1).locator('img')).toHaveCount(2);
  await expect(field(1)).toContainText('portable-name');
  await expect(field(1).locator('.components-spinner')).toHaveCount(0);
  expect((await values()).image).toBe('1604');
  await remove(field(1), 1);
  await expect.poll(async () => (await values()).shots).toEqual([1604, '1605']);
  await remove(field(1));
  await expect.poll(async () => (await values()).shots).toEqual(['1605']);
});

test('the media library can replace a portable scalar with an attachment ID', async () => {
  await field(0).getByRole('button', { name: 'Open Media Library' }).click();
  await page.locator('#menu-item-browse:visible').click();
  await page.locator('li[data-id="1604"]:visible').click();
  await page.locator('.media-frame-toolbar button:visible').click();
  await expect.poll(async () => (await values()).image).toBe(1604);
  await expect(field(0).locator('img')).toHaveCount(1);
  expect((await values()).items).toEqual(initial.items);
});
