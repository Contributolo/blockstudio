---
title: Rendering Attributes
description: Access attribute values in your block templates.
path: "blocks/attributes/rendering"
order: 18
section: "Blocks"
subsection: "Attribute Values"
meta_title: "Rendering Attributes"
meta_description: "Access attribute values in your block templates."
---

# Rendering Attributes

Inside template files, all attributes can be accessed using the `$attributes` or `$a` variables and the respective ID of the field.


## PHP

```php title="index.php"
<h1><?php echo $attributes['message']; ?></h1>
<h1><?php echo $a['message']; ?></h1>
```

## Twig

```twig title="index.twig"
<h1>{{ attributes.message }}</h1>
<h1>{{ a.message }}</h1>
```

## Writing Attributes Programmatically

The editor nests saved values under `blockstudio.attributes`. Anything writing a
block outside the editor, such as the REST API, WP-CLI, a content migration or
an MCP server, discovers the block from the attributes Blockstudio registers on
the `WP_Block_Type` and writes them at the top level. Both shapes render:

```php
// Top level, as a programmatic writer produces it.
echo do_blocks( '<!-- wp:acme/hero {"visual_type":"media"} /-->' );

// Nested, as the editor saves it.
echo do_blocks( '<!-- wp:acme/hero {"blockstudio":{"attributes":{"visual_type":"media"}}} /-->' );
```

Only ids the block declares are read from the top level, so WordPress' own
attributes such as `anchor`, `className`, `lock`, `metadata` and `style` are
never adopted as field values. When the same id appears in both places, the
nested value wins.

## Reading Attributes Programmatically

Code that runs outside the template, such as structured data on `save_post`,
exports, search indexing or a `render_block` filter, often needs a saved
block's values as the template sees them. `bs_block_values()` returns them
without rendering the block. Call it after block registration (`init` or
later) with the complete `attrs` array from `parse_blocks()`:

```php
foreach (parse_blocks($post->post_content) as $block) {
  if ($block['blockName'] === null) {
    continue;
  }

  $a = bs_block_values($block['blockName'], $block['attrs']);

  if ($a === null) {
    // Not a Blockstudio block, and no extension applies.
    continue;
  }

  echo esc_html($a['title'] ?? '');
}
```

The result is the `$a` array of the template, keyed by field id:

- Field defaults apply, and a repeater with `min` has its initial rows.
- Top-level values and `blockstudio.attributes` are merged, and the nested
  value wins. Only declared ids are read from the top level, and WordPress
  drops a top-level value that does not match the field's registered type, for
  example a select string, exactly as on render.
- The fields of matching [extensions](/docs/extensions) are included, with
  their defaults. An extension of a core or third-party block reads
  `blockstudio.attributes` only, as on render.
- Return formats are applied, so a select with `returnFormat` of `label` gives
  the label and a files field gives the attachment data.
- Disabled and empty fields are `false`, as in the template.

`null` means that neither the block nor an extension is managed by Blockstudio.
A Blockstudio block with no fields returns `[]`.

The function runs the same transform as rendering, so it has the same side
effects: files fields query the attachments, a block field that does not return
`data` renders the referenced block, and the
`blockstudio/blocks/attributes/render` filter runs for every value. It does not
render the block's own template and does not resolve `innerBlocks`; walk them
yourself. A code field keeps a generated `%selector%` id that differs between
calls.

Resolution uses the current WordPress context. Render-only metadata such as
block counters and `innerBlocks` is not created; attribute render filters
receive the block name, not a fully rendered block's metadata.

There is no option for the stored values without the transform. Read the
`attrs` array directly for those, or use
[`bs_validate_block()`](/docs/blocks/rendering#validating-stored-values) to
check them.

## Empty Values

Attribute values return `false` if the field is empty or no option has been selected.


### PHP

```php title="index.php"
<?php if ($a['message']) : ?>
  <h1><?php echo $a['message']; ?></h1>
<?php endif; ?>
```

### Twig

```twig title="index.twig"
{% if a.message %}
  <h1>{{ a.message }}</h1>
{% endif %}
```

## Complex Types

### Files

By default (no `returnFormat`, or `"returnFormat": "object"`), the files field
returns an array with the data of the attachment. With `"multiple": true` it
returns a list of these arrays. A file whose attachment no longer exists is
`false`.

| Key | Description |
|-----|-------------|
| `ID` | The attachment ID. |
| `title` | The attachment title. |
| `alt` | The alt text. Falls back to the attachment title when empty. |
| `caption` | The caption. |
| `description` | The description. |
| `href` | The permalink of the attachment page. |
| `url` | The URL of the file. With the size dropdown (`"size": true`), the URL of the selected size. |
| `sizes` | The URL and dimensions of every registered image size, see below. |

#### PHP

```php title="index.php"
<?php if ($a['image']) :
  $image = $a['image'];
  $sizes = $image['sizes'] ?? [];
?>
  <img
    src="<?php echo esc_url($sizes['large'] ?? $image['url']); ?>"
    alt="<?php echo esc_attr($image['alt']); ?>"
    <?php if (isset($sizes['large-width'], $sizes['large-height'])) : ?>
      width="<?php echo esc_attr($sizes['large-width']); ?>"
      height="<?php echo esc_attr($sizes['large-height']); ?>"
    <?php endif; ?>
  />
<?php endif; ?>
```

#### Twig

```twig title="index.twig"
{% if a.image %}
  <img
    src="{{ (a.image.sizes.large ?? a.image.url)|e('html_attr') }}"
    alt="{{ a.image.alt|e('html_attr') }}"
    {% if a.image.sizes['large-width'] is defined and a.image.sizes['large-height'] is defined %}
      width="{{ a.image.sizes['large-width']|e('html_attr') }}"
      height="{{ a.image.sizes['large-height']|e('html_attr') }}"
    {% endif %}
  />
{% endif %}
```

`sizes` has one entry per registered image size plus `full`: the URL under the
size name, and the dimensions under `<size>-width` and `<size>-height`. A size
WordPress has not generated for an attachment resolves to the original file with
its dimensions. If WordPress cannot resolve an image or preview, the `sizes`
key is absent. For example, a PDF without a generated preview has no `sizes`,
but a PDF with preview metadata can have image sizes. `sizes` is `null` when
no image sizes are registered or when the
[`files/sizes` filter](/docs/blocks/hooks/php#attributesfilessizes) disables them.
That filter can also shorten the map, so check a size exists before reading
its dimensions, as in the examples above.

The object has no `width`, `height`, `mime`, `type` or `size` keys. Read the
dimensions from `sizes`, or use `ID` with functions such as
`wp_get_attachment_image()` and `get_post_mime_type()`.

#### Return formats

`returnFormat` changes what the field returns:

| `returnFormat` | Value |
|----------------|-------|
| `"object"` (default) | The array described above. |
| `"id"` | The attachment ID as stored, or a list of IDs with `"multiple": true`. |
| `"url"` | The URL as a string, or a list of URLs with `"multiple": true`. Images use the size set with `returnSize` (default `full`), other files their file URL. |

### Link

The link field returns an object with URL and attributes:


#### PHP

```php title="index.php"
<?php if ($a['link']) : ?>
  <a
    href="<?php echo $a['link']['url']; ?>"
    target="<?php echo $a['link']['target']; ?>"
  >
    <?php echo $a['link']['title']; ?>
  </a>
<?php endif; ?>
```

#### Twig

```twig title="index.twig"
{% if a.link %}
  <a href="{{ a.link.url }}" target="{{ a.link.target }}">
    {{ a.link.title }}
  </a>
{% endif %}
```

### Icon

The icon field returns an object with `set`, `subSet`, and `icon` keys. Use the `bs_render_icon()` and `bs_icon()` helper functions to output the SVG:


#### PHP

```php title="index.php"
<?php if ($a['icon']) : ?>
  <div class="icon">
    <?php bs_render_icon($a['icon']); ?>
  </div>
<?php endif; ?>
```

#### Twig

```twig title="index.twig"
{% if a.icon %}
  <div class="icon">
    {{ bs_icon(a.icon) }}
  </div>
{% endif %}
```

`bs_render_icon()` echoes the SVG directly. `bs_icon()` returns it as a string.

### Attributes

The attributes field type returns an array of `{attribute, value}` pairs for rendering as HTML attributes. Use `bs_render_data_attributes()` to output them:


#### PHP

```php title="index.php"
<div <?php bs_render_data_attributes($a['attributes']); ?>>
  Content
</div>
```

#### Twig

```twig title="index.twig"
<div {{ fn('bs_render_data_attributes', a.attributes) }}>
  Content
</div>
```

`bs_render_data_attributes()` echoes the attributes directly. `bs_data_attributes()` returns the string.

### Group

Group fields prefix their child attribute IDs with the group name. Use `bs_get_group()` to extract group fields into a clean array:


#### PHP

```php title="index.php"
<?php $group = bs_get_group($a, 'settings'); ?>
<h1><?php echo $group['title']; ?></h1>
<p><?php echo $group['description']; ?></p>
```

#### Twig

```twig title="index.twig"
{% set group = fn('bs_get_group', a, 'settings') %}
<h1>{{ group.title }}</h1>
<p>{{ group.description }}</p>
```

This strips the group prefix from attribute keys. For example, `$a['settings_title']` becomes `$group['title']`.

The helper also works when the group comes from a reused custom field:

```json title="fields/section-header/field.json"
{
  "name": "section-header",
  "attributes": [
    {
      "id": "section-header",
      "type": "group",
      "attributes": [
        { "id": "kicker", "type": "text" },
        { "id": "title", "type": "text" }
      ]
    }
  ]
}
```

```json title="block.json"
{
  "blockstudio": {
    "attributes": [
      { "type": "custom/section-header" }
    ]
  }
}
```

```twig title="index.twig"
{% set sectionHeader = fn('bs_get_group', a, 'section-header') %}
<p>{{ sectionHeader.kicker }}</p>
<h2>{{ sectionHeader.title }}</h2>
```

### Repeater

Loop through repeater items:


#### PHP

```php title="index.php"
<?php foreach ($a['items'] as $item) : ?>
  <div class="item">
    <h3><?php echo $item['title']; ?></h3>
    <p><?php echo $item['description']; ?></p>
  </div>
<?php endforeach; ?>
```

#### Twig

```twig title="index.twig"
{% for item in a.items %}
  <div class="item">
    <h3>{{ item.title }}</h3>
    <p>{{ item.description }}</p>
  </div>
{% endfor %}
```


> **[Field Patterns Cookbook](/guides/field-patterns)**
