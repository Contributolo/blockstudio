import { expect, test } from '@playwright/test';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const directory = join(import.meta.dirname, '../../theme/pages');
const pages = readdirSync(directory, { withFileTypes: true })
  .filter((entry) => entry.isDirectory())
  .map((entry) => ({
    name: entry.name,
    ...JSON.parse(
      readFileSync(join(directory, entry.name, 'page.json'), 'utf8'),
    ),
  }));

for (const width of [390, 1280]) {
  test.describe(`UI catalog ${width}px`, () => {
    test.use({ viewport: { width, height: 900 } });

    for (const fixture of pages) {
      test(`${fixture.name} renders without client errors`, async ({
        page,
      }, testInfo) => {
        const errors: string[] = [];
        page.on('pageerror', (error) => errors.push(error.message));
        // Third-party avatar servers must not hold up component screenshots.
        await page.route('**/*', (route) => {
          const url = new URL(route.request().url());
          const decorative = ['image', 'font'].includes(
            route.request().resourceType(),
          );
          return url.hostname !== 'localhost' && decorative
            ? route.abort()
            : route.continue();
        });
        const response = await page.goto(`/${fixture.slug}/`);
        expect(response?.status()).toBe(200);
        const main = page.locator('main');
        await expect(main).toBeVisible();
        await expect(
          main.locator(':scope > :not(script):not(style)').first(),
        ).toBeVisible();
        const missing = await page.evaluate(async () => {
          const references = [...document.querySelectorAll('main *')].flatMap(
            (element) =>
              [...element.attributes]
                .filter((attribute) =>
                  /^data-wp-(on(?:-document|-window)?|watch|init)(--|$)/.test(
                    attribute.name,
                  ),
                )
                .map((attribute) => ({
                  expression: attribute.value,
                  namespace: element
                    .closest('[data-wp-interactive]')
                    ?.getAttribute('data-wp-interactive'),
                })),
          );
          if (!references.length) return [];
          const { store } = await import('@wordpress/interactivity');
          return references.flatMap(({ expression, namespace }) => {
            const qualified = expression.split('::');
            const path = qualified.length === 2 ? qualified[1] : expression;
            if (!/^(actions|callbacks)\./.test(path)) return [];
            let value: any = store(
              qualified.length === 2 ? qualified[0] : namespace!,
            );
            for (const key of path.split('.')) value = value?.[key];
            return typeof value === 'function' ? [] : [expression];
          });
        });
        expect(missing).toEqual([]);
        await page.screenshot({
          path: testInfo.outputPath(`${fixture.name}.png`),
          animations: 'disabled',
        });
        expect(errors).toEqual([]);
      });
    }
  });
}
