---
title: Block Attributes
description: Access standard WordPress block attributes like alignment and typography.
path: "blocks/attributes/block-attributes"
order: 19
section: "Blocks"
subsection: "Attribute Values"
meta_title: "Block Attributes"
meta_description: "Access standard WordPress block attributes like alignment and typography."
---

# Block Attributes

The `$attributes` or `$a` variables only give you access to data registered in the **blockstudio** property. To access standard WordPress block data like alignment or typography, use the `$block` or `$b` variables.

## Rendering


### PHP

```php title="index.php"
<h1>The block is aligned: <?php echo $block['align']; ?></h1>
<h1>The block is aligned: <?php echo $b['align']; ?></h1>
```

### Twig

```twig title="index.twig"
<h1>The block is aligned: {{ block.align }}</h1>
<h1>The block is aligned: {{ b.align }}</h1>
```

## Setting Defaults

### Reserved Field IDs

WordPress-owned attributes must not be declared as Blockstudio fields with the
same top-level ID. `anchor`, `className`, `style`, `lock`, and `metadata` are
reserved, as are Blockstudio's internal `blockstudio`, `__BLOCKSTUDIO_KEY`,
and `blockEditingMode` attributes.

Enabled WordPress supports reserve their attribute names too: `align`,
`backgroundColor`, `textColor`, `gradient`, `fontSize`, `fontFamily`, `layout`,
`borderColor`, `shadow`, and `ariaLabel`, as applicable. A native declaration
of one of those attributes also reserves that name. This avoids replacing,
for example, core's string `align` with a select field's option object.

Conflicting fields are skipped at registration and logged through
`blockstudio/error/logged` (and the WordPress debug log when enabled), naming
the block and field. Their editor controls, storage handlers, and render
definitions are not registered. Rename the field to `headingAlign`, or put it
inside a named group such as `presentation` to produce `presentation_align`.
Repeater-row fields live inside their row and are not top-level collisions.
An ordinary `align` field remains valid when alignment support is disabled
and no native `align` attribute exists.

When upgrading an existing block with a collision, rename its field and
migrate any saved field values to the new ID. Blockstudio does not silently
rename stored content or remove the WordPress support.

### Native Attribute Defaults

To set a default value for WordPress properties like `align`, add a `default` key inside the `attributes` key:

```json title="block.json"
{
  "$schema": "https://blockstudio.dev/schema/block",
  "name": "blockstudio/block",
  "title": "Native Block",
  "icon": "star-filled",
  "description": "Native Block.",
  "supports": {
    "align": ["left", "center", "right"]
  },
  "attributes": {
    "align": {
      "type": "string",
      "default": "center"
    }
  },
  "blockstudio": true
}
```

## Available Block Data

The `$block` / `$b` variable contains:

| Property | Description |
|----------|-------------|
| `name` | Block name (e.g., `my-theme/my-block`) |
| `title` | Block title |
| `dir` | Block directory path |
| `url` | Block directory URL |
| `align` | Alignment value (if `supports.align` is enabled) |
| `className` | Custom CSS class (if `supports.customClassName` is enabled) |
| `anchor` | HTML anchor/ID (if `supports.anchor` is enabled) |

## WordPress Supports

Enable WordPress block features via the `supports` property:

```json title="block.json"
{
  "supports": {
    "align": true,
    "anchor": true,
    "customClassName": true,
    "color": {
      "background": true,
      "text": true
    },
    "spacing": {
      "margin": true,
      "padding": true
    },
    "typography": {
      "fontSize": true,
      "lineHeight": true
    }
  }
}
```

See the [WordPress Block Supports documentation](https://developer.wordpress.org/block-editor/reference-guides/block-api/block-supports/) for all available options.
