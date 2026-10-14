import { expect, Frame, Page, test } from '@playwright/test';
import {
  getEditorCanvas,
  getSharedPage,
  openSidebar,
  resetPageState,
  save,
} from '../utils/playwright-utils';

let page: Page;
let canvas: Frame;

test.describe.configure({ mode: 'serial' });

const values = async () =>
  page.evaluate(() =>
    (window as any).wp.data
      .select('core/block-editor')
      .getBlocks()
      .map((block: any) => ({
        key: block.attributes.__BLOCKSTUDIO_KEY,
        richtext: block.attributes.blockstudio.attributes.richtext,
        text: block.attributes.blockstudio.attributes.text,
        lock: block.attributes.lock,
        metadata: block.attributes.metadata,
      })),
  );

test.beforeEach(async ({ browser }) => {
  page = await getSharedPage(browser);
  await resetPageState(page);
  canvas = await getEditorCanvas(page);
  await page.evaluate(() => {
    const wp = (window as any).wp;
    wp.data
      .dispatch('core/block-editor')
      .updateSettings({ templateLock: false });
    wp.data.dispatch('core/block-editor').resetBlocks([
      wp.blocks.createBlock('blockstudio/editor-audit', {
        __BLOCKSTUDIO_KEY: 'first',
        lock: { move: true, remove: true },
        metadata: { name: 'First audit block' },
        blockstudio: {
          attributes: { richtext: 'First content', text: 'First field' },
        },
      }),
      wp.blocks.createBlock('blockstudio/editor-audit', {
        __BLOCKSTUDIO_KEY: 'second',
        metadata: { name: 'Second audit block' },
        blockstudio: {
          attributes: { richtext: 'Second content', text: 'Second field' },
        },
      }),
    ]);
  });
  await expect(canvas.locator('.editor-audit')).toHaveCount(2);
  await openSidebar(page);
  await expect(
    canvas.locator('[aria-label="Audit rich text"]').first(),
  ).toHaveText('First content');
});

test.afterEach(async () => {
  await page.evaluate(() =>
    (window as any).wp.data
      .dispatch('core/block-editor')
      .updateSettings({ templateLock: false }),
  );
});

test('multi-selected save preserves each blocks content and identity across reload', async () => {
  await canvas
    .locator('[aria-label="Audit rich text"]')
    .first()
    .fill('Edited first content');
  await canvas
    .locator('[aria-label="Audit rich text"]')
    .nth(1)
    .fill('Edited second content');
  const expected = await values();
  await page.evaluate(() => {
    const wp = (window as any).wp;
    const blocks = wp.data.select('core/block-editor').getBlocks();
    wp.data
      .dispatch('core/block-editor')
      .multiSelect(blocks[0].clientId, blocks[1].clientId);
  });
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          (window as any).wp.data
            .select('core/block-editor')
            .getMultiSelectedBlockClientIds().length,
      ),
    )
    .toBe(2);
  await save(page);
  await page.reload();
  canvas = await getEditorCanvas(page);
  await expect.poll(values).toEqual(expected);
  await expect(
    canvas.locator('[aria-label="Audit rich text"]').first(),
  ).toHaveText('Edited first content');
  await expect(
    canvas.locator('[aria-label="Audit rich text"]').nth(1),
  ).toHaveText('Edited second content');
});

test('sidebar changes target only their own block during multi-selection', async () => {
  await canvas.locator('[aria-label="Audit rich text"]').first().click();
  const input = page.locator('[data-id="text"] input').first();
  await expect(input).toHaveValue('First field');
  await input.focus();
  await page.evaluate(() => {
    const wp = (window as any).wp;
    const blocks = wp.data.select('core/block-editor').getBlocks();
    wp.data
      .dispatch('core/block-editor')
      .multiSelect(blocks[0].clientId, blocks[1].clientId);
  });
  // Retain the inspector's input to exercise its handler while core broadcasts selection.
  await page.keyboard.press('ControlOrMeta+A');
  await page.keyboard.type('Changed field');
  await expect
    .poll(async () => (await values()).map((block: any) => block.text))
    .toEqual(['Changed field', 'Second field']);
  await expect
    .poll(async () => (await values()).map((block: any) => block.key))
    .toEqual(['first', 'second']);
});

test('RichText and sidebar edits participate in undo and redo', async () => {
  const richtext = canvas.locator('[aria-label="Audit rich text"]').first();
  await richtext.click();
  await page.keyboard.press('End');
  await page.keyboard.type(' changed');
  await page.locator('[data-id="text"] input').first().click();
  await expect(richtext).toHaveText('First content changed');
  await page.getByRole('button', { name: 'Undo', exact: true }).click();
  await expect(richtext).toHaveText('First content');
  await page.getByRole('button', { name: 'Redo', exact: true }).click();
  await expect(richtext).toHaveText('First content changed');
  const input = page.locator('[data-id="text"] input').first();
  await input.fill('Changed sidebar');
  await richtext.click();
  await expect(input).toHaveValue('Changed sidebar');
  await page.getByRole('button', { name: 'Undo', exact: true }).click();
  await expect(input).toHaveValue('First field');
  await page.getByRole('button', { name: 'Redo', exact: true }).click();
  await expect(input).toHaveValue('Changed sidebar');
});

test('templateLock false permits paragraphs inside a locked parent', async () => {
  await page.evaluate(() =>
    (window as any).wp.data
      .dispatch('core/block-editor')
      .updateSettings({ templateLock: 'all' }),
  );
  const first = canvas.locator('.editor-audit').first();
  const paragraph = first
    .locator('[data-type="core/paragraph"] [contenteditable="true"]')
    .first();
  await paragraph.click();
  await page.keyboard.press('End');
  await page.keyboard.press('Enter');
  await page.keyboard.type('Added inside a locked parent');
  await expect(first.locator('[data-type="core/paragraph"]')).toHaveCount(2);
  await expect(first).toContainText('Added inside a locked parent');
});

test('canvas block roots remain adjacent without hidden render markers', async () => {
  await expect(canvas.locator('[data-blockstudio-render-marker]')).toHaveCount(
    0,
  );
  await canvas.addStyleTag({
    content:
      '.editor-audit + .editor-audit { outline: 3px solid rgb(12, 34, 56); }',
  });
  const roots = canvas.locator('.editor-audit');
  await expect(roots.nth(1)).toHaveCSS('outline-color', 'rgb(12, 34, 56)');
  expect(
    await roots
      .first()
      .evaluate((root) =>
        root.nextElementSibling?.classList.contains('editor-audit'),
      ),
  ).toBe(true);
});
