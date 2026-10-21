import { expect, Page, test } from '@playwright/test';
import {
  getEditorCanvas,
  login,
  resetPageState,
  save,
} from '../utils/playwright-utils';

let page: Page;

test.beforeEach(async ({ browser }) => {
  page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  page.on('dialog', (dialog) => dialog.accept());
  await login(page);
  await resetPageState(page);
});

test.afterEach(async () => {
  await resetPageState(page);
  await save(page);
  await page.close();
});

test('fresh unselected blocks get nested defaults with one insertion undo and no hidden fields', async () => {
  const initial = await page.evaluate(() => {
    const wp = (window as any).wp;
    const block = wp.blocks.createBlock('blockstudio/type-repeater-complete');
    const snapshot = JSON.stringify(block.attributes);
    (window as any).initializationPortals = 0;
    const observer = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        for (const node of mutation.addedNodes) {
          if (
            node instanceof HTMLElement &&
            (node.matches('[data-blockstudio-initialization]') ||
              node.querySelector('[data-blockstudio-initialization]'))
          )
            (window as any).initializationPortals++;
        }
      }
    });
    observer.observe(document.body, { childList: true, subtree: true });
    (window as any).initializationObserver = observer;
    wp.data.dispatch('core/block-editor').insertBlocks([block]);
    wp.data.dispatch('core/block-editor').clearSelectedBlock();
    return snapshot;
  });
  const attributes = JSON.parse(initial).blockstudio.attributes;
  expect(attributes.repeater).toHaveLength(1);
  expect(attributes.repeater[0].repeater).toHaveLength(1);
  expect(attributes.repeater[0].repeater[0].repeater).toHaveLength(1);
  const canvas = await getEditorCanvas(page);
  await expect(
    canvas.locator('[data-type="blockstudio/type-repeater-complete"]'),
  ).toHaveCount(1);
  await expect(canvas.locator('.blockstudio-test__block')).toHaveCount(1);
  await expect(canvas.locator('.blockstudio-block__inner-spinner')).toHaveCount(
    0,
  );
  expect(
    await page.evaluate(() => {
      const wp = (window as any).wp;
      return JSON.stringify(
        wp.data.select('core/block-editor').getBlocks()[0].attributes,
      );
    }),
  ).toBe(initial);
  expect(await page.evaluate(() => (window as any).initializationPortals)).toBe(
    0,
  );
  await expect(
    page.locator('[data-blockstudio-initialization] .ProseMirror'),
  ).toHaveCount(0);
  await page.evaluate(() => {
    (window as any).initializationObserver.disconnect();
    (window as any).wp.data.dispatch('core/editor').undo();
  });
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          (window as any).wp.data.select('core/block-editor').getBlocks()
            .length,
      ),
    )
    .toBe(0);
});

test('loading stored blocks preserves attributes and clean state without hidden editors or formatter requests', async () => {
  const snapshot = await page.evaluate(() => {
    const wp = (window as any).wp;
    const blocks = Array.from({ length: 12 }, () =>
      wp.blocks.createBlock('blockstudio/type-repeater-complete'),
    );
    wp.data.dispatch('core/block-editor').resetBlocks(blocks);
    wp.data.dispatch('core/block-editor').clearSelectedBlock();
    return JSON.stringify(blocks.map((block: any) => block.attributes));
  });
  await save(page);
  const formatterRequests: string[] = [];
  page.on('request', (request) => {
    if (/\/blocks\/prettier[^/]*\.js/.test(request.url()))
      formatterRequests.push(request.url());
  });
  await page.addInitScript(() => {
    (window as any).initializationPortals = 0;
    new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        for (const node of mutation.addedNodes) {
          if (
            node instanceof HTMLElement &&
            (node.matches('[data-blockstudio-initialization]') ||
              node.querySelector('[data-blockstudio-initialization]'))
          )
            (window as any).initializationPortals++;
        }
      }
    }).observe(document, { childList: true, subtree: true });
  });
  await page.reload();
  const canvas = await getEditorCanvas(page);
  await expect(
    canvas.locator('[data-type="blockstudio/type-repeater-complete"]'),
  ).toHaveCount(12);
  await expect(canvas.locator('.blockstudio-test__block')).toHaveCount(12);
  await expect(canvas.locator('.blockstudio-block__inner-spinner')).toHaveCount(
    0,
  );
  expect(
    await page.evaluate(() =>
      (window as any).wp.data
        .select('core/block-editor')
        .getBlocks()
        .map((block: any) => block.attributes),
    ),
  ).toEqual(JSON.parse(snapshot));
  expect(await page.evaluate(() => (window as any).initializationPortals)).toBe(
    0,
  );
  expect(
    await page.evaluate(() =>
      (window as any).wp.data.select('core/editor').isEditedPostDirty(),
    ),
  ).toBe(false);
  await expect(
    page.locator('[data-blockstudio-initialization] .ProseMirror'),
  ).toHaveCount(0);
  expect(formatterRequests).toEqual([]);
});

test('matching extension defaults are available before selection without mounting their controls', async () => {
  const snapshot = await page.evaluate(() => {
    const wp = (window as any).wp;
    const block = wp.blocks.createBlock('blockstudio/type-text');
    const attributes = JSON.parse(JSON.stringify(block.attributes));
    wp.data.dispatch('core/block-editor').insertBlocks([block]);
    wp.data.dispatch('core/block-editor').clearSelectedBlock();
    return attributes;
  });
  expect(snapshot.blockstudio.attributes.textClassSelect.value).toBe('class-2');
  expect(snapshot.blockstudio.attributes.textColor.value).toBe('#f00');
  const canvas = await getEditorCanvas(page);
  await expect(canvas.locator('.blockstudio-test__block')).toHaveCount(1);
  await expect(canvas.locator('.blockstudio-block__inner-spinner')).toHaveCount(
    0,
  );
  await expect(page.locator('[data-blockstudio-initialization]')).toHaveCount(
    0,
  );
  expect(
    await page.evaluate(
      () =>
        (window as any).wp.data.select('core/block-editor').getBlocks()[0]
          .attributes,
    ),
  ).toEqual(snapshot);
});
