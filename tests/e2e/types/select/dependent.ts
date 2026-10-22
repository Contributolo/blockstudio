import { expect, Page, test } from '@playwright/test';
import {
  getEditorCanvas,
  login,
  resetPageState,
  save,
} from '../../utils/playwright-utils';

let page: Page;

test.beforeEach(async ({ browser }) => {
  page = await browser.newPage();
  page.on('dialog', (dialog) => dialog.accept());
  await page.setViewportSize({ width: 1440, height: 1000 });
  await login(page);
  await resetPageState(page);
});

test.afterEach(async () => {
  await resetPageState(page);
  await save(page);
  await page.close();
});

test('dependent selects fetch options and preserve saved return formats in previews and on the frontend', async () => {
  await page.evaluate(() => {
    const wp = (window as any).wp;
    const first = { value: 'a', label: 'Item A (post)' };
    const block = wp.blocks.createBlock('blockstudio/type-select-dependent', {
      blockstudio: {
        attributes: {
          kind: { value: 'post', label: 'Post' },
          single: first,
          multiple: [first],
          label: first,
          both: first,
        },
      },
    });
    wp.data.dispatch('core/block-editor').resetBlocks([block]);
    wp.data.dispatch('core/block-editor').selectBlock(block.clientId);
  });

  const canvas = await getEditorCanvas(page);
  const preview = canvas.locator('[data-dependent-values]');
  const readPreview = async () =>
    JSON.parse((await preview.getAttribute('data-dependent-values'))!);
  const expected = {
    kind: 'post',
    single: 'a',
    multiple: ['a'],
    label: 'Item A (post)',
    both: { value: 'a', label: 'Item A (post)' },
  };

  await expect.poll(readPreview).toEqual(expected);
  await preview.click();
  const settings = page.getByRole('button', { name: 'Settings', exact: true });
  if ((await settings.getAttribute('aria-pressed')) !== 'true') {
    await settings.click();
  }
  await page.getByRole('tab', { name: 'Block', exact: true }).click();
  const single = page.locator('.blockstudio-fields [data-id="single"]');
  await expect(single).toBeVisible();
  await single.getByRole('combobox').fill('Item B');
  await single.getByRole('option', { name: 'Item B (post)', exact: true }).click();
  expected.single = 'b';
  await expect.poll(readPreview).toEqual(expected);
  await save(page);

  const saved = await page.evaluate(async () => {
    const wp = (window as any).wp;
    return wp.apiFetch({ path: '/wp/v2/posts/1483?context=edit' });
  });
  const frontend = await page.context().newPage();
  try {
    const response = await frontend.goto(saved.link);
    expect(response?.status()).toBe(200);
    const values = await frontend
      .locator('[data-dependent-values]')
      .getAttribute('data-dependent-values');
    expect(JSON.parse(values!)).toEqual(expected);
    const after = await page.evaluate(async () => {
      return (window as any).wp.apiFetch({
        path: '/wp/v2/posts/1483?context=edit',
      });
    });
    expect(after.content.raw).toBe(saved.content.raw);
  } finally {
    await frontend.close();
  }

  await page.reload();
  const reloaded = await getEditorCanvas(page);
  await expect
    .poll(async () =>
      JSON.parse(
        (await reloaded
          .locator('[data-dependent-values]')
          .getAttribute('data-dependent-values'))!,
      ),
    )
    .toEqual(expected);
});
