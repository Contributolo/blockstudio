import { expect, Frame, Locator, Page, test } from '@playwright/test';
import {
  getEditorCanvas,
  getSharedPage,
  resetPageState,
  save,
} from '../utils/playwright-utils';

let page: Page;
let canvas: Frame;

const blockName = 'blockstudio/component-editor-links';

test.beforeEach(async ({ browser }) => {
  page = await getSharedPage(browser);
  await resetPageState(page);
  canvas = await getEditorCanvas(page);
});

const insert = async (root: string) => {
  const ids = await page.evaluate(
    ({ name, root }) => {
      const wp = (window as any).wp;
      const block = wp.blocks.createBlock(name, {
        blockstudio: { attributes: { root, text: 'Unsaved editable text' } },
      });
      const control = wp.blocks.createBlock('core/paragraph', {
        content: 'Control block',
      });
      wp.data.dispatch('core/block-editor').resetBlocks([block, control]);
      return { block: block.clientId, control: control.clientId };
    },
    { name: blockName, root },
  );
  await expect(canvas.locator('.editor-links')).toHaveCount(1);
  return ids;
};

const expectSafeClick = async (
  target: Locator,
  selected: string,
  control: string,
) => {
  await page.evaluate((id) => {
    (window as any).wp.data.dispatch('core/block-editor').selectBlock(id);
  }, control);
  const editorUrl = page.url();
  const canvasUrl = canvas.url();
  const content = await page.evaluate(() =>
    (window as any).wp.data.select('core/editor').getEditedPostContent(),
  );
  await target.evaluate((element) => {
    (window as any).__editorLinkPrevented = false;
    element.addEventListener(
      'click',
      (event) => {
        (window as any).__editorLinkPrevented = event.defaultPrevented;
      },
      { once: true },
    );
  });
  await target.click();
  expect(
    await canvas.evaluate(() => (window as any).__editorLinkPrevented),
  ).toBe(true);
  await expect
    .poll(() =>
      page.evaluate(() =>
        (window as any).wp.data
          .select('core/block-editor')
          .getSelectedBlockClientId(),
      ),
    )
    .toBe(selected);
  expect(page.url()).toBe(editorUrl);
  expect(canvas.url()).toBe(canvasUrl);
  expect(
    await page.evaluate(() =>
      (window as any).wp.data.select('core/editor').getEditedPostContent(),
    ),
  ).toBe(content);
  expect(
    await page.evaluate(() =>
      (window as any).wp.data.select('core/editor').isEditedPostDirty(),
    ),
  ).toBe(true);
};

for (const root of ['props', 'fallback']) {
  test(`${root} roots disable text, new-tab, SVG and fragment links without losing selection or unsaved content`, async () => {
    const ids = await insert(root);
    for (const link of ['normal', 'blank', 'icon', 'fragment']) {
      await expectSafeClick(
        canvas.locator(`[data-editor-link="${link}"]`),
        ids.block,
        ids.control,
      );
    }
    const richtext = canvas.locator('.editor-links [contenteditable="true"]');
    await richtext.click();
    await page.keyboard.press('End');
    await page.keyboard.type(' changed');
    await expect(richtext).toHaveText('Unsaved editable text changed');
  });
}

test('anchor block roots do not navigate', async () => {
  const ids = await insert('anchor');
  await expectSafeClick(
    canvas.locator('[data-editor-link="root"]'),
    ids.block,
    ids.control,
  );
});

test('bare InnerBlocks roots preserve nested block selection', async () => {
  const ids = await insert('innerblocks');
  const childId = await canvas
    .locator('.editor-links')
    .getAttribute('data-block');
  expect(childId).toBeTruthy();
  await expectSafeClick(
    canvas.locator('[data-editor-link="normal"]'),
    childId!,
    ids.control,
  );
});

test('bare RichText roots remain editable with links', async () => {
  await page.evaluate((name) => {
    const wp = (window as any).wp;
    wp.data.dispatch('core/block-editor').resetBlocks([
      wp.blocks.createBlock(name, {
        blockstudio: {
          attributes: {
            root: 'richtext',
            text: '<a href="/?blockstudio-editor-link=richtext">Editable link</a>',
          },
        },
      }),
    ]);
  }, blockName);
  const richtext = canvas.locator(
    '.editor-links-richtext[contenteditable="true"]',
  );
  const link = richtext.locator('a');
  await expect(link).toHaveText('Editable link');
  const url = canvas.url();
  await link.click();
  expect(canvas.url()).toBe(url);
  await richtext.press('End');
  await page.keyboard.type(' changed');
  await expect(richtext).toHaveText('Editable link changed');
});

test('keyboard, modifier and middle clicks are canceled and existing wrapper handlers still run', async () => {
  await page.evaluate(() => {
    const wp = (window as any).wp;
    wp.hooks.addFilter(
      'editor.BlockListBlock',
      'blockstudio-test/link-handlers',
      wp.compose.createHigherOrderComponent(
        (BlockListBlock: any) => (props: any) =>
          wp.element.createElement(BlockListBlock, {
            ...props,
            wrapperProps: {
              ...props.wrapperProps,
              onClickCapture: () => {
                (window as any).__editorLinkClickHandler = true;
              },
              onAuxClickCapture: () => {
                (window as any).__editorLinkAuxHandler = true;
              },
            },
          }),
        'testLinkHandlers',
      ),
      20,
    );
  });
  try {
    await insert('props');
    const link = canvas.locator('[data-editor-link="normal"]').locator('..');
    for (const modifiers of [
      { ctrlKey: true },
      { metaKey: true },
      { shiftKey: true },
      { altKey: true },
    ]) {
      expect(
        await link.evaluate(
          (element, modifiers) =>
            element.dispatchEvent(
              new MouseEvent('click', {
                bubbles: true,
                cancelable: true,
                ...modifiers,
              }),
            ),
          modifiers,
        ),
      ).toBe(false);
    }
    expect(
      await page.evaluate(() => (window as any).__editorLinkClickHandler),
    ).toBe(true);
    expect(
      await link.evaluate((element) =>
        element.dispatchEvent(
          new MouseEvent('auxclick', {
            bubbles: true,
            cancelable: true,
            button: 1,
          }),
        ),
      ),
    ).toBe(false);
    expect(
      await page.evaluate(() => (window as any).__editorLinkAuxHandler),
    ).toBe(true);
    await link.evaluate((element) => {
      (window as any).__editorKeyboardLinkPrevented = false;
      element.addEventListener(
        'click',
        (event) => {
          (window as any).__editorKeyboardLinkPrevented =
            event.defaultPrevented;
        },
        { once: true },
      );
    });
    const url = canvas.url();
    await link.focus();
    await link.press('Enter');
    expect(
      await canvas.evaluate(
        () => (window as any).__editorKeyboardLinkPrevented,
      ),
    ).toBe(true);
    expect(canvas.url()).toBe(url);
  } finally {
    await page.evaluate(() =>
      (window as any).wp.hooks.removeFilter(
        'editor.BlockListBlock',
        'blockstudio-test/link-handlers',
      ),
    );
  }
});

test('saved frontend links still navigate normally', async () => {
  await insert('props');
  await save(page);
  const frontend = await page.context().newPage();
  try {
    await frontend.goto('http://localhost:8888/native-single/');
    await frontend.locator('[data-editor-link="normal"]').click();
    await expect(frontend).toHaveURL(
      'http://localhost:8888/?blockstudio-editor-link=normal',
    );
  } finally {
    await frontend.close();
  }
});
