import { expect, Locator, Page, test } from '@playwright/test';
import { getEditorCanvas, login, save } from '../../utils/playwright-utils';

// Extension: tests/theme/blockstudio/extensions/set-list.json (core/verse).
// Values are stored the way the editor saves them.
const stored = {
  setListLink: [
    { value: '/first/', label: 'First link' },
    { value: '/second/', label: 'Second link' },
  ],
  setListAnchor: [
    { value: 'first-anchor', label: 'First anchor' },
    { value: 'second-anchor', label: 'Second anchor' },
  ],
  setListLangs: [
    { value: 'en-au', label: 'Set list English' },
    { value: 'de', label: 'Set list German' },
  ],
  setListLanguages: [
    { value: 'en-au', label: 'English' },
    { value: 'de', label: 'German' },
  ],
  setListTags: [
    { value: 'news', label: 'news' },
    { value: 'featured', label: 'featured' },
  ],
  setListEmpty: [],
  setListTone: 'warm',
};

const names = [
  'href',
  'id',
  'data-langs',
  'data-last-lang',
  'data-has-lang',
  'data-languages',
  'data-last-language',
  'data-tags',
  'data-last-tag',
  'data-empty',
  'data-tone',
];

// data-langs, data-has-lang, data-languages, data-tags, data-empty and
// data-tone use "join". Without it the last entry wins, as it always did.
const expected = {
  href: '/second/',
  id: 'second-anchor',
  'data-langs': 'en-au de',
  'data-last-lang': 'de',
  'data-has-lang': 'yes',
  'data-languages': 'English German',
  'data-last-language': 'German',
  'data-tags': 'news featured',
  'data-last-tag': 'featured',
  'data-empty': null,
  'data-tone': 'tone-warm',
};

const expectedWithFrench = {
  ...expected,
  'data-langs': 'en-au de fr',
  'data-last-lang': 'fr',
};

const read = (element: Locator, attributeNames: string[]) =>
  element.evaluate((el, attributeNames) => {
    const style = getComputedStyle(el);

    return {
      attributes: Object.fromEntries(
        attributeNames.map((name) => [name, el.getAttribute(name)]),
      ),
      classes: [...el.classList].filter((name) => name.startsWith('lang-')),
      declarations: ['en-au', 'de', 'fr'].filter(
        (lang) => style.getPropertyValue(`--lang-${lang}`).trim() === '1',
      ),
    };
  }, attributeNames);

const surface = (
  attributes: Record<string, string | null>,
  langs: string[],
  attributeNames = names,
) => ({
  attributes: Object.fromEntries(
    attributeNames.map((name) => [name, attributes[name]]),
  ),
  classes: langs.map((lang) => `lang-${lang}`),
  declarations: langs,
});

// The block editor sets its own id on the wrapper, so the props the
// extension filter passes are read by a filter that runs inside it.
const captureWrapperProps = (page: Page) =>
  page.evaluate(() => {
    const wp = (window as any).wp;
    wp.hooks.addFilter(
      'editor.BlockListBlock',
      'blockstudio-test/extension-set',
      (BlockListBlock: any) => (props: any) => {
        if (props.name === 'core/verse') {
          (window as any).blockstudioTestWrapperProps = props.wrapperProps;
        }

        return wp.element.createElement(BlockListBlock, props);
      },
      5,
    );
  });

const wrapperProps = (page: Page) =>
  page.evaluate(() => {
    const props = (window as any).blockstudioTestWrapperProps || {};

    return Object.fromEntries(
      Object.entries(props).filter(([, value]) => value !== undefined),
    );
  });

const withoutNull = (attributes: Record<string, string | null>) =>
  Object.fromEntries(
    Object.entries(attributes).filter(([, value]) => value !== null),
  );

test('set writes list entries alike in the editor and on the frontend', async ({
  page,
  baseURL,
}) => {
  await login(page, baseURL);
  const nonce = await (
    await page.request.get('/wp-admin/admin-ajax.php?action=rest-nonce')
  ).text();
  const headers = { 'X-WP-Nonce': nonce };
  const content = `<!-- wp:verse ${JSON.stringify({
    blockstudio: { attributes: stored },
  })} --><pre class="wp-block-verse">Set list</pre><!-- /wp:verse -->`;
  const post = await (
    await page.request.post('/wp-json/wp/v2/pages', {
      headers,
      data: { title: 'Extension set lists', status: 'publish', content },
    })
  ).json();

  const editorNames = names.filter((name) => name !== 'id');
  const verse = async () =>
    (await getEditorCanvas(page)).locator('[data-type="core/verse"]');

  try {
    await test.step('frontend', async () => {
      await page.goto(post.link);
      expect(await read(page.locator('pre.wp-block-verse'), names)).toEqual(
        surface(expected, ['en-au', 'de']),
      );
    });

    await test.step('editor', async () => {
      await page.goto(`/wp-admin/post.php?post=${post.id}&action=edit`);
      await expect(await verse()).toBeVisible();
      // Closes the welcome guide and keeps it from opening over the block.
      await page.evaluate(() =>
        (window as any).wp.data
          .dispatch('core/preferences')
          .set('core/edit-post', 'welcomeGuide', false),
      );

      await captureWrapperProps(page);
      await expect
        .poll(() => wrapperProps(page))
        .toEqual(withoutNull(expected));
      await expect
        .poll(async () => read(await verse(), editorNames))
        .toEqual(surface(expected, ['en-au', 'de'], editorNames));
    });

    await test.step('editor after checking another entry', async () => {
      await (await verse()).click();
      await page
        .locator('[data-id="setListLangs"]:visible')
        .getByLabel('Set list French')
        .check();

      await expect
        .poll(() => wrapperProps(page))
        .toEqual(withoutNull(expectedWithFrench));
      await expect
        .poll(async () => read(await verse(), editorNames))
        .toEqual(
          surface(expectedWithFrench, ['en-au', 'de', 'fr'], editorNames),
        );
    });

    await test.step('frontend after saving', async () => {
      await save(page);
      await page.goto(post.link);
      expect(await read(page.locator('pre.wp-block-verse'), names)).toEqual(
        surface(expectedWithFrench, ['en-au', 'de', 'fr']),
      );
    });
  } finally {
    await page.request.delete(`/wp-json/wp/v2/pages/${post.id}?force=true`, {
      headers,
    });
  }
});
