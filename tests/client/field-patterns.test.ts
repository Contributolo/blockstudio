import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

test('the field patterns tabs example uses tabs with top-level field storage', () => {
  const guide = readFileSync('docs/guides/field-patterns.md', 'utf8');
  const example = guide.match(
    /### Tabs for major sections[\s\S]*?```json[^\n]*\n([\s\S]*?)\n```/,
  );
  assert.ok(example, 'The guide must contain its tabs example.');
  const field = JSON.parse(example[1]);
  assert.equal(field.type, 'tabs');
  assert.equal(field.attributes, undefined);
  assert.deepEqual(
    field.tabs.map((tab: { title: string }) => tab.title),
    ['Content', 'Media', 'Settings'],
  );
  assert.deepEqual(
    field.tabs.flatMap((tab: { attributes: { id: string }[] }) =>
      tab.attributes.map((child) => child.id),
    ),
    ['title', 'body', 'image', 'video', 'layout', 'fullWidth'],
  );
});
