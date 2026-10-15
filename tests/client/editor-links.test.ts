import assert from 'node:assert/strict';
import { test } from 'node:test';
import { preventEditorLinkNavigation } from '../../src/blocks/utils/prevent-editor-link-navigation';

const click = (target: unknown, root: unknown) => {
  let prevented = false;
  preventEditorLinkNavigation({
    target: target as EventTarget,
    currentTarget: root as HTMLElement,
    preventDefault: () => {
      prevented = true;
    },
  });
  return prevented;
};

const linkTarget = (root: unknown) => {
  const link = {
    nodeType: 1,
    closest: (selector: string): unknown => {
      if (selector === 'a[href]') return link;
      assert.equal(selector, '[data-block]');
      return root;
    },
  };
  return link;
};

test('editor links are canceled on anchor roots, descendant elements and text nodes', () => {
  const root = {};
  const link = linkTarget(root);
  assert.equal(click(link, root), true);
  const descendant = {
    nodeType: 1,
    closest: (selector: string) => {
      assert.equal(selector, 'a[href]');
      return link;
    },
  };
  assert.equal(click(descendant, root), true);
  assert.equal(click({ nodeType: 3, parentElement: descendant }, root), true);
  const anchorRoot = linkTarget(null);
  anchorRoot.closest = () => anchorRoot;
  assert.equal(click(anchorRoot, anchorRoot), true);
});

test('non-links, missing targets, portals and nested blocks are not intercepted', () => {
  const root = {};
  assert.equal(click({ nodeType: 1, closest: () => null }, root), false);
  assert.equal(click(null, root), false);
  assert.equal(click({}, root), false);
  assert.equal(click(linkTarget(null), root), false);
  assert.equal(click(linkTarget({}), root), false);
});
