import { Editor } from '@tiptap/core';
import { Link } from '@tiptap/extension-link';
import StarterKit from '@tiptap/starter-kit';
import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  getWysiwygLinkAttributes,
  getWysiwygLinkHTMLAttributes,
} from '../../src/blocks/utils/wysiwyg-link';
import type { BlockstudioAttribute } from '../../src/types/block';

const field = (link: Record<string, unknown>) =>
  ({ type: 'wysiwyg', toolbar: { formats: { link } } }) as BlockstudioAttribute;

const createEditor = (item: BlockstudioAttribute) =>
  new Editor({
    element: null,
    extensions: [
      StarterKit.configure({ link: false }),
      Link.configure({
        autolink: false,
        openOnClick: false,
        HTMLAttributes: getWysiwygLinkHTMLAttributes(item),
      }),
    ],
    content: {
      type: 'doc',
      content: [
        { type: 'paragraph', content: [{ type: 'text', text: 'Hello world' }] },
      ],
    },
  });

// The link mark's DOM spec without null values, which ProseMirror's
// serializer skips. These are the attributes getHTML() writes.
const rendered = (editor: Editor) => {
  const mark = editor.state.doc
    .nodeAt(1)
    ?.marks.find(({ type }) => type.name === 'link');
  assert.ok(mark);
  const [, attributes] = editor.schema.marks.link.spec.toDOM?.(mark, true) as [
    string,
    Record<string, unknown>,
  ];

  return Object.fromEntries(
    Object.entries(attributes).filter(([, value]) => value != null),
  );
};

// The link modal hands over the link with target and rel already set for
// "Open in new tab" (normalizeLinkChange in fields/components/link.tsx).
const modalLink = (url: string, opensInNewTab: boolean) =>
  opensInNewTab
    ? { url, opensInNewTab, target: '_blank', rel: 'noreferrer noopener' }
    : { url, opensInNewTab };

const insertLink = (
  editor: Editor,
  item: BlockstudioAttribute,
  link: ReturnType<typeof modalLink>,
) => {
  editor.commands.setTextSelection({ from: 1, to: 6 });
  assert.equal(
    editor.commands.setLink(getWysiwygLinkAttributes(item, link)),
    true,
  );
};

for (const url of ['/contact/', 'https://wordpress.org/']) {
  test(`toolbar link to ${url} only gets target and rel for a new tab`, () => {
    const item = field({ opensInNewTab: true });

    const sameTab = createEditor(item);
    insertLink(sameTab, item, modalLink(url, false));
    assert.deepEqual(rendered(sameTab), { href: url });

    const newTab = createEditor(item);
    insertLink(newTab, item, modalLink(url, true));
    assert.deepEqual(rendered(newTab), {
      href: url,
      target: '_blank',
      rel: 'noreferrer noopener',
    });
  });
}

test('turning off "Open in new tab" removes target and rel again', () => {
  const item = field({ opensInNewTab: true });
  const editor = createEditor(item);

  insertLink(editor, item, modalLink('/contact/', true));
  insertLink(editor, item, modalLink('/contact/', false));

  assert.deepEqual(rendered(editor), { href: '/contact/' });
});

test('stored links without target or rel do not get them on the next edit', () => {
  const item = field({ opensInNewTab: true });
  const editor = createEditor(item);

  // Parsing a stored <a href> falls back to the attribute defaults for
  // target and rel when the element has none.
  editor.commands.setTextSelection({ from: 1, to: 6 });
  editor.commands.setMark('link', { href: '/contact/' });

  assert.deepEqual(rendered(editor), { href: '/contact/' });
});

test('configured link attributes apply to every link', () => {
  const item = field({
    opensInNewTab: true,
    attributes: { rel: 'nofollow', class: 'field-link' },
  });

  const sameTab = createEditor(item);
  insertLink(sameTab, item, modalLink('/contact/', false));
  assert.deepEqual(rendered(sameTab), {
    href: '/contact/',
    rel: 'nofollow',
    class: 'field-link',
  });

  const newTab = createEditor(item);
  insertLink(newTab, item, modalLink('/contact/', true));
  assert.deepEqual(rendered(newTab), {
    href: '/contact/',
    target: '_blank',
    rel: 'nofollow noreferrer noopener',
    class: 'field-link',
  });
});
