import { expect, Page, Frame } from '@playwright/test';
import { openSidebar, testType, text } from '../../utils/playwright-utils';

const input = (page: Page) =>
  page.locator(
    '.blockstudio-fields .blockstudio-fields__field--select .components-select-control__input'
  );

testType('select-empty', '"choice":false', () => {
  return [
    {
      description: 'shows no option while nothing is stored',
      testFunction: async (page: Page, canvas: Frame) => {
        await canvas.click('[data-type="blockstudio/type-select-empty"]');
        await openSidebar(page);
        await expect(input(page)).toHaveValue('');
        await text(canvas, '"choice":false');
      },
    },
    {
      description: 'select first option directly from the empty state',
      testFunction: async (page: Page, canvas: Frame) => {
        await expect(input(page).locator('option').first()).toBeDisabled();
        await input(page).selectOption('one');
        await text(canvas, '"choice":"one"');
        await expect(input(page)).toHaveValue('one');
        await expect(input(page).locator('option[value=""]')).toHaveCount(0);
      },
    },
    {
      description: 'select second option',
      testFunction: async (page: Page, canvas: Frame) => {
        await input(page).selectOption('two');
        await text(canvas, '"choice":"two"');
        await expect(input(page)).toHaveValue('two');
      },
    },
    {
      description: 'select first option',
      testFunction: async (page: Page, canvas: Frame) => {
        await input(page).selectOption('one');
        await text(canvas, '"choice":"one"');
        await expect(input(page)).toHaveValue('one');
      },
    },
  ];
});
