import { Page, Frame, expect } from '@playwright/test';
import { count, testType } from '../../utils/playwright-utils';

testType('wysiwyg-switch', 'Default text', () => [
  {
    description: 'type and switch',
    testFunction: async (page: Page, canvas: Frame) => {
      const loaded = await page.evaluate(() =>
        performance.getEntriesByType('resource').map((entry) => entry.name),
      );
      const chunk = (pattern: RegExp) => {
        const existing = loaded.find((url) => pattern.test(url));
        return existing
          ? page.request.get(existing)
          : page.waitForResponse((response) => pattern.test(response.url()));
      };
      const standalone = chunk(/\/blocks\/prettier\.js\?ver=/);
      const html = chunk(/\/blocks\/prettier-html\.js\?ver=/);
      await page.click('text=Switch to Code');
      expect((await standalone).status()).toBe(200);
      expect((await html).status()).toBe(200);
      await page.click('.cm-line');
      await page.keyboard.press('ControlOrMeta+A');
      await page.keyboard.press('Backspace');
      await page.keyboard.type('<h1>Switch Test</h1>');
      await count(page, 'text=Switch Test', 1);
      await page.click('text=Switch to Visual');
      await count(page, 'text=Switch Test', 1);
      await count(canvas, 'text=Switch Test', 1);
    },
  },
]);
