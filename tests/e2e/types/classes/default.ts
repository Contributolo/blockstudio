import { expect, Page, Frame } from '@playwright/test';
import { count, testType, text, saveAndReload, getEditorCanvas } from '../../utils/playwright-utils';

testType('classes', '"classes":"class-1 class-2"', () => {
  return [
    {
      description: 'add class from suggestions',
      testFunction: async (page: Page, canvas: Frame) => {
        await canvas.click('[data-type="blockstudio/type-classes"]');
        await page.fill('.components-form-token-field input', 'is-');
        await count(page, 'text=is-dark-theme', 1);
      },
    },
    {
      description: 'add custom class and retain on blur',
      testFunction: async (page: Page, canvas: Frame) => {
        await canvas.click('[data-type="blockstudio/type-classes"]');
        const input = page.locator('.components-form-token-field input');
        await input.fill('my-custom-class');
        await input.press('Enter');
        await expect(page.getByRole('button', { name: 'my-custom-class' })).toBeVisible();
      },
    },
    {
      description: 'show css rule of a class on hover',
      testFunction: async (page: Page, canvas: Frame) => {
        await canvas.click('[data-type="blockstudio/type-classes"]');
        const input = page.locator('.components-form-token-field input');
        await input.fill('is-large');
        await input.press('Enter');
        const token = page.getByRole('button', {
          name: 'is-large',
          exact: true,
        });
        await token.hover();
        await expect(
          token.locator('xpath=following-sibling::div[1]')
        ).toContainText('font-size: 2em');
      },
    },
    {
      description: 'show css rule of a class that needs escaping on hover',
      testFunction: async (page: Page, canvas: Frame) => {
        await canvas.click('[data-type="blockstudio/type-classes"]');
        const input = page.locator('.components-form-token-field input');
        await input.fill('2xl:w-1/2');
        await input.press('Enter');
        const token = page.getByRole('button', {
          name: '2xl:w-1/2',
          exact: true,
        });
        await token.hover();
        await expect(
          token.locator('xpath=following-sibling::div[1]')
        ).toContainText('width: 50%');
      },
    },
    {
      description: 'custom class persists after save and reload',
      testFunction: async (page: Page, canvas: Frame) => {
        await saveAndReload(page);
        canvas = await getEditorCanvas(page);
        await text(canvas, 'my-custom-class');
      },
    },
  ];
});
