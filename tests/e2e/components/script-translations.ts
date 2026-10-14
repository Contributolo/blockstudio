import { expect, Page, test } from '@playwright/test';
import { getEditorCanvas, login } from '../utils/playwright-utils';

const base = 'http://localhost:8888';

test.beforeEach(async ({ page }) => {
  await login(page);
});

async function openBlock(
  page: Page,
  name: string,
  attributes: Record<string, unknown> = {},
) {
  await page.goto(
    `${base}/wp-admin/post.php?post=1483&action=edit&blockstudioTestTranslations=1`,
  );
  const canvas = await getEditorCanvas(page);
  await expect(canvas.locator('.is-root-container')).toBeVisible();
  await page.evaluate(
    ({ name, attributes }) => {
      const wp = (window as any).wp;
      const block = wp.blocks.createBlock(name, {
        blockstudio: { attributes },
      });
      const editor = wp.data.dispatch('core/block-editor');
      editor.updateSettings({ templateLock: false });
      editor.resetBlocks([block]);
      editor.selectBlock(block.clientId);
    },
    { name, attributes },
  );
  const settings = page.getByRole('button', { name: 'Settings', exact: true });
  if ((await settings.getAttribute('aria-pressed')) !== 'true') {
    await settings.click();
  }
  await page.getByRole('tab', { name: 'Block', exact: true }).click();
  await expect(page.locator('#blockstudio-blocks-js-translations')).toHaveCount(
    1,
  );
}

test('admin translations load before the overview renders', async ({
  page,
}) => {
  await page.goto(
    `${base}/wp-admin/tools.php?page=blockstudio-admin&blockstudioTestTranslations=1`,
  );
  await expect(
    page.locator('#blockstudio-admin-page-js-translations'),
  ).toHaveCount(1);
  await expect(
    page
      .locator('#blockstudio-admin')
      .getByRole('button', { name: 'Uebersicht', exact: true }),
  ).toBeVisible();
});

test('attribute controls use the loaded translations', async ({ page }) => {
  await openBlock(page, 'blockstudio/type-attributes', {
    attributes: [{ attribute: 'data-test', value: '' }],
  });
  const field = page.locator('[data-id="attributes"]');
  await expect(
    field.getByRole('button', { name: 'Mehr', exact: true }),
  ).toBeVisible();
  await expect(field.locator('.cm-placeholder')).toHaveText('Wert');
});

test('code popup action uses the loaded translation', async ({ page }) => {
  await openBlock(page, 'blockstudio/type-code-popout');
  await expect(
    page.getByRole('button', { name: 'Im Popup oeffnen', exact: true }).first(),
  ).toBeVisible();
});

test('media cards translate known badges and preserve other media types', async ({
  page,
}) => {
  await openBlock(page, 'blockstudio/type-files', { filesSingleId: 1604 });
  const field = page.locator('[data-id="filesSingleId"]');
  await expect(field.getByText('Bild', { exact: true })).toBeVisible();
  for (const [mediaType, label] of [
    ['file', 'Datei'],
    ['video', 'video'],
  ]) {
    await page.evaluate((mediaType) => {
      const wp = (window as any).wp;
      const media = wp.data.select('blockstudio/blocks').getMedia()[1604];
      wp.data.dispatch('blockstudio/blocks').setMedia({
        1604: { ...media, media_type: mediaType },
      });
    }, mediaType);
    await expect(field.getByText(label, { exact: true })).toBeVisible();
  }
});
