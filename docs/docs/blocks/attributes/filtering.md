---
title: Filtering Attributes
description: Filter and modify block attributes with PHP hooks.
path: "blocks/attributes/filtering"
order: 17
section: "Blocks"
subsection: "Attributes"
meta_title: "Filtering Attributes"
meta_description: "Filter and modify block attributes with PHP hooks."
---

# Filtering Attributes

Blockstudio provides two methods to filter block attributes.

## Attribute Definitions

`blockstudio/blocks/attributes` filters each field definition while Blockstudio
builds and registers a block. Use it to adjust editor controls, defaults,
conditions, options, and the definition used to validate values during
rendering.

```php title="functions.php"
add_filter('blockstudio/blocks/attributes', function($attribute, $block) {
  if (
    ($block['name'] ?? '') === 'my-theme/code-block' &&
    ($attribute['id'] ?? '') === 'lineNumbers'
  ) {
    $attribute['default'] = true;
    $attribute['conditions'] = [
      [
        [
          'id' => 'language',
          'operator' => '==',
          'value' => 'css'
        ]
      ]
    ];
  }

  return $attribute;
}, 10, 2);
```

The code above sets the default value of `lineNumbers` to `true` and hides the
field unless `language` is set to `css`.

The callback receives one field definition per invocation, including nested
group and repeater fields. It runs during block registration, not once per
frontend render.

Filtered option definitions are also used by the render attribute map. For
example, an option added to a `select`, `radio`, or `checkbox` field is
available in the editor and remains valid when Blockstudio resolves the saved
value for a template:

```php title="functions.php"
add_filter('blockstudio/blocks/attributes', function($attribute, $block) {
  if (
    ($block['name'] ?? '') === 'bsui/button' &&
    ($attribute['id'] ?? '') === 'variant'
  ) {
    $attribute['options'][] = [
      'label' => 'Brand',
      'value' => 'brand',
    ];
  }

  return $attribute;
}, 10, 2);
```

## Rendered Values

`blockstudio/blocks/attributes/render` filters the resolved value of one field
immediately before it is passed to the block template. It runs once for every
field, so a callback receives the value, the field key, and the block data.

```php title="functions.php"
add_filter('blockstudio/blocks/attributes/render', function($value, $key, $block) {
  if (($block['name'] ?? '') === 'my-theme/code-block' && 'lineNumbers' === $key) {
    return true;
  }
  return $value;
}, 10, 3);
```

The example above overrides any value saved in the editor for `lineNumbers`.
Register the callback with three accepted arguments (the last argument of
`add_filter`), otherwise WordPress passes only the value.

- `$value`: the resolved value of the field, in the shape the template receives
  as `$a[$key]`. Return the value the template should get.
- `$key`: the key of the field, as used in `$a`. Inside a repeater row this is
  the ID of the field within the row.
- `$block`: the block data array that templates receive as `$block` or `$b`,
  with `id`, `name`, `postId`, `postType`, `index`, `indexTotal`, `context` and
  the island flags. For [extensions](/docs/extensions) applied to a
  block that is not a Blockstudio block, `$block` holds only the `blockstudio`
  entry (`attributes` and `disabled`) and has no `name`.

The filter also runs for attributes that are not Blockstudio fields, such as
`className` and `anchor`, and for the `<id>__size` companion of a files field,
so compare `$key` before changing a value. The return value replaces the value
of `$key` only; the filter cannot add new keys to `$a`.

Use the definition filter when changing field configuration and the render
filter when computing or overriding template values for a request.
