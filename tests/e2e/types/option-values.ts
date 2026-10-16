import { expect, Frame, Page, test } from '@playwright/test';
import {
  getEditorCanvas,
  getSharedPage,
  openSidebar,
  resetPageState,
  saveAndReload,
} from '../utils/playwright-utils';

type Option = { value: number | string; label: string };

const option = (value: number | string, label = `${value}`): Option => ({
  value,
  label,
});

// The first two options of each field. Every field starts with 0 or "0"
// stored, the falsy case of the edit path.
const fields = {
  checkboxNumber: [option(0, 'Zero'), option(1, 'One')],
  checkboxString: [option('0', 'Zero'), option('1', 'One')],
  checkboxPlainNumber: [option(0), option(1)],
  checkboxPlainString: [option('0'), option('1')],
  selectNumber: [option(0, 'Zero'), option(1, 'One')],
  selectString: [option('0', 'Zero'), option('1', 'One')],
  selectPlainNumber: [option(0), option(1)],
  selectPlainString: [option('0'), option('1')],
};

type Field = keyof typeof fields;

const ids = Object.keys(fields) as Field[];
const checkboxes = ids.filter((id) => id.startsWith('checkbox'));
const selects = ids.filter((id) => id.startsWith('select'));

const stored: Record<string, Record<Field, unknown>> = {
  scalar: Object.fromEntries(
    ids.map((id) => [id, fields[id][0].value]),
  ) as Record<Field, unknown>,
  'single option': Object.fromEntries(
    ids.map((id) => [id, fields[id][0]]),
  ) as Record<Field, unknown>,
};

let page: Page;
let canvas: Frame;

const values = () =>
  page.evaluate(
    () =>
      (window as any).wp.data.select('core/block-editor').getBlocks()[0]
        .attributes.blockstudio.attributes,
  );

const savedValues = () =>
  page.evaluate(async () => {
    const wp = (window as any).wp;
    const id = wp.data.select('core/editor').getCurrentPostId();
    const post = await wp.apiFetch({ path: `/wp/v2/posts/${id}?context=edit` });

    return wp.blocks.parse(post.content.raw)[0].attributes.blockstudio
      .attributes;
  });

const rendered = (selection: (options: Option[]) => Option[]) =>
  JSON.stringify(
    Object.fromEntries(
      ids.map((id) => [id, selection(fields[id]).map((e) => e.value)]),
    ),
  );

const field = (id: Field) => page.locator(`[data-id="${id}"]`);

const checkbox = (id: Field, index: number) =>
  field(id).getByRole('checkbox', {
    name: fields[id][index].label,
    exact: true,
  });

const cards = (id: Field) =>
  field(id).locator('[data-rfd-draggable-context-id]');

const expectSelection = async (selection: (options: Option[]) => Option[]) => {
  for (const id of checkboxes) {
    for (const [index, item] of fields[id].entries()) {
      const box = checkbox(id, index);
      if (selection(fields[id]).includes(item)) {
        await expect(box).toBeChecked();
      } else {
        await expect(box).not.toBeChecked();
      }
    }
  }
  for (const id of selects) {
    await expect(cards(id)).toHaveText(
      selection(fields[id]).map((e) => e.label),
    );
  }
  await expect(canvas.locator('.option-values code')).toHaveText(
    rendered(selection),
  );
};

const selectBlock = async () => {
  canvas = await getEditorCanvas(page);
  await canvas.locator('.option-values').click();
  await openSidebar(page);
};

const zero = (options: Option[]) => [options[0]];
const both = (options: Option[]) => options;
const one = (options: Option[]) => [options[1]];

for (const [shape, initial] of Object.entries(stored)) {
  test.describe(`option values stored as a ${shape}`, () => {
    test.describe.configure({ mode: 'serial' });

    test.beforeAll(async ({ browser }) => {
      page = await getSharedPage(browser);
      await resetPageState(page);
      await page.evaluate((attributes) => {
        const wp = (window as any).wp;
        const block = wp.blocks.createBlock('blockstudio/type-option-values', {
          blockstudio: { attributes },
        });
        wp.data.dispatch('core/block-editor').resetBlocks([block]);
      }, initial);
      await selectBlock();
    });

    test('shows the stored selection and keeps its shape on save and reload', async () => {
      await expectSelection(zero);
      expect(await values()).toEqual(initial);

      await saveAndReload(page);
      await selectBlock();

      expect(await savedValues()).toEqual(initial);
      expect(await values()).toEqual(initial);
      await expectSelection(zero);
    });

    test('adding an option keeps the stored one', async () => {
      for (const id of checkboxes) {
        await checkbox(id, 1).click();
      }
      for (const id of selects) {
        await field(id).locator('.components-form-token-field__input').click();
        await page
          .getByRole('option', { name: fields[id][1].label, exact: true })
          .click();
      }

      await expect
        .poll(values)
        .toEqual(Object.fromEntries(ids.map((id) => [id, fields[id]])));
      await expectSelection(both);
    });

    test('removing the stored option keeps the added one', async () => {
      for (const id of checkboxes) {
        await checkbox(id, 0).click();
      }
      for (const id of selects) {
        const remove = cards(id)
          .first()
          .locator('.blockstudio-fields__field--files-toggle');
        await remove.hover();
        await remove.click();
      }

      const expected = Object.fromEntries(
        ids.map((id) => [id, [fields[id][1]]]),
      );
      await expect.poll(values).toEqual(expected);
      await expectSelection(one);

      await saveAndReload(page);
      await selectBlock();

      expect(await savedValues()).toEqual(expected);
      await expectSelection(one);
    });
  });
}
