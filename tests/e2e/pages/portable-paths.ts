import { expect, test } from '@playwright/test';

test('portable and legacy CLI source paths serve Markdown and layouts without rewriting posts or metadata', async ({
  request,
}) => {
  const base = 'http://localhost:8888';
  const fixture = `${base}/wp-json/blockstudio-test/v1/pages/path-fixture`;
  const snapshot = async (data = {}) => {
    const response = await request.post(fixture, { data });
    expect(response.status()).toBe(200);
    return response.json();
  };
  const original = await snapshot();
  for (const path of Object.values(original.paths)) {
    expect(path).toMatch(/^(?:parent-)?theme:/);
  }
  try {
    for (const legacy of [false, true]) {
      const before = legacy ? await snapshot({ action: 'legacy' }) : original;
      const html = await request.get(`${base}/docs/guide/install/`);
      expect(html.status()).toBe(200);
      expect(await html.text()).toContain('data-docs-layout');
      for (const [url, headers] of [
        [`${base}/docs/guide/install.md`, {}],
        [`${base}/docs/guide/install/`, { Accept: 'text/markdown' }],
      ] as const) {
        const response = await request.get(url, { headers });
        expect(response.status()).toBe(200);
        expect(response.headers()['content-type']).toContain('text/markdown');
        expect(await response.text()).toContain('Installation');
      }
      expect(await snapshot()).toEqual(before);
    }
  } finally {
    await snapshot({ restore: original.paths });
  }
});
