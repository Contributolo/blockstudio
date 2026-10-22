import { expect, test } from '@playwright/test';
import {
  getEditorCanvas,
  login,
  resetPageState,
} from '../utils/playwright-utils';

const cases = [
  {
    type: 'code',
    initial: 'initial-code',
    latest: 'latest-code',
    selector: '.cm-content',
  },
  {
    type: 'classes',
    initial: 'initial-class',
    latest: 'latest-class',
    selector: '.blockstudio-class',
  },
  {
    type: 'attributes',
    initial: [{ attribute: 'data-test', value: 'initial-value' }],
    latest: [{ attribute: 'data-test', value: 'latest-value' }],
    selector: '.cm-content',
  },
  {
    type: 'wysiwyg',
    initial: '<p>Initial content</p>',
    latest: '<p>Latest content</p>',
    selector: '.ProseMirror',
  },
];

for (const { type, initial, latest, selector } of cases) {
  test(`${type} loads on selection and keeps values changed while its chunk is pending`, async ({
    page,
  }) => {
    page.on('dialog', (dialog) => dialog.accept());
    const requests: string[] = [];
    page.on('request', (request) => {
      if (/\/blocks\/(?:field-|codemirror|tiptap)/.test(request.url())) {
        requests.push(request.url());
      }
    });
    let release = () => {};
    const pending = new Promise<void>((resolve) => {
      release = resolve;
    });
    await page.route(`**/blocks/field-${type}.js*`, async (route) => {
      await pending;
      await route.continue();
    });

    try {
      await login(page);
      await resetPageState(page);
      const clientId = await page.evaluate(
        ({ type, initial }) => {
          const wp = (window as any).wp;
          const block = wp.blocks.createBlock(`blockstudio/type-${type}`, {
            blockstudio: { attributes: { [type]: initial } },
          });
          const editor = wp.data.dispatch('core/block-editor');
          editor.resetBlocks([block]);
          editor.clearSelectedBlock();
          return block.clientId;
        },
        { type, initial },
      );
      const canvas = await getEditorCanvas(page);
      const block = canvas.locator(`[data-block="${clientId}"]`);
      await expect(
        block.locator('.blockstudio-block__inner-spinner'),
      ).toHaveCount(0);
      await expect(block).toBeVisible();
      expect(requests).toEqual([]);

      await block.click();
      const settings = page.getByRole('button', {
        name: 'Settings',
        exact: true,
      });
      if ((await settings.getAttribute('aria-pressed')) !== 'true')
        await settings.click();
      await page.getByRole('tab', { name: 'Block', exact: true }).click();
      const field = page.locator(`.blockstudio-fields [data-id="${type}"]`);
      await expect(field).toBeVisible();
      await expect
        .poll(() => requests.some((url) => url.includes(`/field-${type}.js`)))
        .toBe(true);
      await expect(field.locator(selector)).toHaveCount(0);
      await page.evaluate(
        ({ clientId, type, latest }) => {
          const wp = (window as any).wp;
          const attributes = wp.data
            .select('core/block-editor')
            .getBlockAttributes(clientId);
          wp.data
            .dispatch('core/block-editor')
            .updateBlockAttributes(clientId, {
              blockstudio: {
                ...attributes.blockstudio,
                attributes: {
                  ...attributes.blockstudio.attributes,
                  [type]: latest,
                },
              },
            });
        },
        { clientId, type, latest },
      );

      release();
      if (type === 'classes') {
        await expect(
          field.getByText('latest-class', { exact: true }),
        ).toBeVisible();
      } else {
        await expect(field.locator(selector).first()).toHaveText(
          type === 'attributes'
            ? 'latest-value'
            : type === 'wysiwyg'
              ? 'Latest content'
              : 'latest-code',
        );
      }
      await expect
        .poll(() =>
          page.evaluate(
            ({ clientId, type }) => {
              return (window as any).wp.data
                .select('core/block-editor')
                .getBlockAttributes(clientId).blockstudio.attributes[type];
            },
            { clientId, type },
          ),
        )
        .toEqual(latest);

      if (type === 'wysiwyg') {
        expect(requests.some((url) => url.includes('/codemirror'))).toBe(false);
        await field
          .getByRole('button', { name: 'Switch to Code', exact: true })
          .click();
        await expect(field.locator('.cm-content')).toContainText(
          'Latest content',
        );
        expect(requests.some((url) => url.includes('/field-code.js'))).toBe(
          true,
        );
      }
    } finally {
      release();
    }
  });
}
