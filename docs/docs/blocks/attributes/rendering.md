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
<?php if ($a['image']) : ?>
  <img
    src="<?php echo $a['image']['sizes']['large']; ?>"
    alt="<?php echo $a['image']['alt']; ?>"
    width="<?php echo $a['image']['sizes']['large-width']; ?>"
    height="<?php echo $a['image']['sizes']['large-height']; ?>"
  />
<?php endif; ?>
```

#### Twig

```twig title="index.twig"
{% if a.image %}
  <img
    src="{{ a.image.sizes.large }}"
    alt="{{ a.image.alt }}"
    width="{{ a.image.sizes['large-width'] }}"
    height="{{ a.image.sizes['large-height'] }}"
  />
{% endif %}
```

`sizes` has one entry per registered image size plus `full`: the URL under the
size name, and the dimensions under `<size>-width` and `<size>-height`. A size
WordPress has not generated for an attachment resolves to the original file with
its dimensions. Attachments that are not images, such as PDFs, have no `sizes`
key. `sizes` is `null` when no image sizes are registered.

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
