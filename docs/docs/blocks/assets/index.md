---
title: General
description: Automatically enqueue and process CSS, SCSS, and JavaScript files for your blocks.
path: "blocks/assets"
order: 8
section: "Blocks"
subsection: "Assets"
meta_title: "General"
meta_description: "Automatically enqueue and process CSS, SCSS, and JavaScript files for your blocks."
---

# Assets

Blockstudio provides a zero-config asset pipeline for your blocks. Drop CSS, SCSS, or JavaScript files next to your block and they get compiled, minified, and enqueued automatically.

- [Registering Assets](/docs/blocks/assets/registering):File naming conventions and enqueue behavior
- [Processing](/docs/blocks/assets/processing):SCSS compilation, ES module imports, and minification
- [Code Field](/docs/blocks/assets/code-field):Inline code editing via the code field type

## Inspecting a Block's Assets

`bs_block_assets('theme/card')` returns the discovered frontend and editor-canvas
assets of a registered Blockstudio block. Call it after block registration, on `init` or later.
Unknown blocks, non-Blockstudio blocks, and blocks without assets return `[]`.
The helper does not render the block, enqueue anything, or trigger compilation.

```php
$assets = bs_block_assets('theme/card');

// Each entry has this shape:
[
  'type' => 'style',
  'handle' => 'blockstudio-theme-card-style-css',
  'url' => '/wp-content/blockstudio/cache/.../style-123.css?ver=123',
  'inline' => false,
  'scope' => ['frontend', 'editor'],
  'html' => '<link ...>',
];
```

- `type` is `style` for CSS and `module` for JavaScript. Blockstudio's file-based
  JavaScript assets use ES modules, including inline scripts.
- `handle` is the stable asset identifier used by Blockstudio's renderer and
  the `blockstudio/assets/disable` filter. It need not be enqueued in WordPress.
- `url` is the resolved URL of the existing compiled asset, including its version,
  or the source URL when no compiled file exists. It is `null` for inline assets.
- `inline` distinguishes inline `<style>`/`<script>` output from external files.
- `scope` lists the contexts where the asset applies: `frontend` and `editor`
  for shared files, and only one for view/editor files.
- `html` contains the ready-to-use tag from the normal asset renderer. Inline
  content, scoped CSS, UI style layers, and render-time disable filters are
  handled the same way as ordinary block output.

Missing, empty, disabled, and uncompiled SCSS files are omitted. WordPress-enqueued
admin and block-editor parent-document assets are excluded. The list is
limited to the block's own discovered files. It is not a dependency closure:
nested blocks, code-field values, WordPress-enqueued handles, module CSS imports,
Tailwind, and shared UI/Interactivity runtimes may depend on rendered content.
Use [`Render::document()`](/docs/blocks/rendering#structured-compositions-and-complete-documents)
for a complete self-contained preview. Use `bs_block_fields()` to inspect
the registered field definitions.
