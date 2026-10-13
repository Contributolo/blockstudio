---
title: Building a Custom Field Type
description: Register a namespaced editor control with a structured value, store it in post meta with a REST schema, and use it inside repeaters and templates like a built-in field.
path: "custom-field-types"
order: 13
section: "Guides"
meta_title: "Building a Custom Field Type"
meta_description: "Register a namespaced editor control with a structured value, store it in post meta with a REST schema, and use it inside repeaters and templates like a built-in field."
---

# Building a Custom Field Type

Some values are more than one primitive. A price is an amount and a currency.
With built-in fields you model it as a number field and a select field side by
side, and every block that shows a price repeats the pair, the labels, and the
logic that keeps them together. In post meta it becomes two keys, and inside a
repeater two parallel lists.

A custom field type turns the pair into one field. You register a type such as
`acme/price` once, in PHP and in JavaScript, and then use it in any
`block.json` like a native field: at the top level, inside groups and
repeaters, with post meta or option storage, and in PHP, Twig, and Blade
templates. Blockstudio derives the WordPress attribute and the storage REST
schema from the registration.

This is different from a [custom field](/docs/blocks/attributes/custom-fields).
A `custom/{name}` reference reuses a group of existing fields. A custom field
type adds a new control with its own value shape.

This guide builds `acme/price` end to end: the PHP registration, the editor
control, a pricing block that uses it at the top level and inside a repeater,
post meta storage with a strict REST schema, and the rendered output.

## Register the type in PHP

The PHP side declares the attribute type, the default, the editor script that
provides the control, and how the value is stored outside the block:

```php title="functions.php"
add_action( 'init', function () {
	wp_register_script(
		'acme-field-price',
		get_stylesheet_directory_uri() . '/fields/price.js',
		array( 'blockstudio-blocks', 'wp-components', 'wp-element' ),
		'1.0.0',
		true
	);

	bs_register_field_type( 'acme/price', array(
		'attribute'     => 'object',
		'default'       => array(),
		'editor_script' => 'acme-field-price',
		'storage'       => array(
			'type'        => 'object',
			'rest_schema' => array(
				'type'                 => 'object',
				'properties'           => array(
					'amount'   => array( 'type' => 'number', 'minimum' => 0 ),
					'currency' => array( 'type' => 'string', 'pattern' => '^[A-Z]{3}$' ),
				),
				'additionalProperties' => false,
			),
		),
	) );
} );
```

`attribute` is the WordPress attribute type, here `object`. `storage.type` is
the value type used when the field is stored in post meta or options, and
`storage.rest_schema` is the schema WordPress validates REST writes against.
Without a `rest_schema`, an object value gets a permissive schema that accepts
any properties.

Register on `init` at the default priority. Blockstudio discovers blocks late
on `init`, and a type that is not registered by then is left out of the
generated block attributes.

`bs_register_field_type()` returns `true` on success and `false` when the name
or definition is invalid. Names must be lowercase, namespaced, and dashcase,
and two namespaces are reserved:

| Name | Result |
| --- | --- |
| `acme/price` | `true` |
| `Acme/Price` | `false`, not lowercase |
| `custom/price` | `false`, reserved for reusable field groups |
| `blockstudio/price` | `false`, reserved for Blockstudio core |

`bs_unregister_field_type()` removes a registration again, and the
`blockstudio/field_types` filter accepts the same definitions as an array keyed
by name.

## Build the editor control

The script registered above provides the React component. It uses the
WordPress components already loaded in the editor, so it needs no build step:

```js title="fields/price.js"
const { createElement: el } = wp.element;
const { Flex, FlexBlock, FlexItem, SelectControl, TextControl } = wp.components;

window.blockstudio.registerFieldType('acme/price', {
  component(props) {
    const value =
      props.value && typeof props.value === 'object' && !Array.isArray(props.value)
        ? props.value
        : {};
    const currencies = props.currencies || ['EUR'];

    return el(
      Flex,
      { align: 'flex-end' },
      el(
        FlexBlock,
        {},
        el(TextControl, {
          label: props.label,
          type: 'number',
          min: 0,
          step: 0.01,
          disabled: props.disabled,
          value: value.amount ?? '',
          onChange(next) {
            props.onChange({ ...value, amount: next === '' ? 0 : Number(next) });
          },
        }),
      ),
      el(
        FlexItem,
        {},
        el(SelectControl, {
          label: 'Currency',
          hideLabelFromVision: true,
          disabled: props.disabled,
          value: value.currency || currencies[0],
          options: currencies.map((code) => ({ label: code, value: code })),
          onChange(next) {
            props.onChange({ ...value, currency: next });
          },
        }),
      ),
    );
  },
});
```

The component receives every property of the field definition, so the
`currencies` key you put in `block.json` arrives as `props.currencies`. It also
receives stable props: `value`, `onChange`, `field`, `defaultValue`,
`attributes`, `block`, `clientId`, `disabled`, and `inRepeater` with
`repeaterId` when it renders inside a repeater row. `onChange` stores the value
exactly as given. Custom values skip the option normalization that native
`select`, `radio`, `color`, and `gradient` fields apply.

Guard against values that are not objects, as the first lines do. A block
saved before the field existed, or with a different shape, should still open
in the editor.

Blockstudio enqueues `acme-field-price` in the block editor only when a block
that uses `acme/price` is registered. If the script fails to register the
control, the editor keeps the saved value and shows a non-editable notice in
place of the field, and the frontend still renders the value.

## Use it in a block

A pricing block uses the type twice: once for a starting price that should be
queryable outside the block, and once per row of a tiers repeater:

```json title="blockstudio/pricing/block.json"
{
  "$schema": "https://blockstudio.dev/schema/block",
  "apiVersion": 3,
  "name": "acme/pricing",
  "title": "Pricing",
  "blockstudio": {
    "attributes": [
      {
        "id": "price",
        "type": "acme/price",
        "label": "Starting price",
        "currencies": ["EUR", "USD"],
        "default": { "amount": 19, "currency": "EUR" },
        "storage": {
          "type": "postMeta",
          "postMetaKey": "acme_price"
        }
      },
      {
        "id": "tiers",
        "type": "repeater",
        "label": "Tiers",
        "min": 0,
        "max": 4,
        "attributes": [
          { "id": "name", "type": "text", "label": "Name", "default": "" },
          {
            "id": "price",
            "type": "acme/price",
            "label": "Price",
            "currencies": ["EUR", "USD"],
            "default": { "amount": 0, "currency": "EUR" },
            "storage": {
              "type": "postMeta",
              "postMetaKey": "acme_tier_prices"
            }
          }
        ]
      }
    ]
  }
}
```

A field-level `default` wins over the registry default. Blockstudio turns both
fields into WordPress attributes from the registration. The registered block
type carries:

```json
{
  "price": {
    "blockstudio": true,
    "type": "object",
    "field": "acme/price",
    "id": "price",
    "default": { "amount": 19, "currency": "EUR" },
    "storage": { "type": "postMeta", "postMetaKey": "acme_price" }
  },
  "tiers": {
    "blockstudio": true,
    "type": "array",
    "field": "repeater",
    "id": "tiers",
    "attributes": [
      { "blockstudio": true, "type": "string", "field": "text", "default": "", "id": "name" },
      {
        "blockstudio": true,
        "type": "object",
        "field": "acme/price",
        "id": "price",
        "default": { "amount": 0, "currency": "EUR" },
        "storage": { "type": "postMeta", "postMetaKey": "acme_tier_prices" }
      }
    ]
  }
}
```

## Render the value

In the template the value is an ordinary array. Narrow it before use, because
a stored value is only as trustworthy as the last thing that wrote it:

```php title="blockstudio/pricing/index.php"
<?php
/** @var array{price: mixed, tiers: array<int, array{name: string, price: mixed}>} $a */
$format = static function ( mixed $price ): string {
	if ( ! is_array( $price ) ) {
		return '';
	}
	$amount   = is_numeric( $price['amount'] ?? null ) ? (float) $price['amount'] : 0.0;
	$currency = is_string( $price['currency'] ?? null ) ? $price['currency'] : '';

	return number_format_i18n( $amount, 2 ) . ' ' . $currency;
};
?>
<section useBlockProps class="acme-pricing">
  <p>From <?php echo esc_html( $format( $a['price'] ) ); ?></p>
  <?php foreach ( $a['tiers'] ?: array() as $tier ) : ?>
    <div class="acme-tier">
      <h3><?php echo esc_html( $tier['name'] ); ?></h3>
      <p><?php echo esc_html( $format( $tier['price'] ?? null ) ); ?></p>
    </div>
  <?php endforeach; ?>
</section>
```

The `?: array()` matters. A repeater with no rows reaches the template as
`false`, not as an empty array, and a bare `foreach` over it raises a PHP
warning. The `@var` line is explained under [static
analysis](#static-analysis) below.

Rendering the block with a starting price and two tiers:

```php
echo bs_block( array(
	'name' => 'acme/pricing',
	'data' => array(
		'price' => array( 'amount' => 19, 'currency' => 'EUR' ),
		'tiers' => array(
			array( 'name' => 'Starter', 'price' => array( 'amount' => 19, 'currency' => 'EUR' ) ),
			array( 'name' => 'Team', 'price' => array( 'amount' => 49, 'currency' => 'EUR' ) ),
		),
	),
) );
```

```html
<!--blockstudio/acme/pricing--><section class="acme-pricing wp-block-acme-pricing">
  <p>From 19.00 EUR</p>
      <div class="acme-tier">
      <h3>Starter</h3>
      <p>19.00 EUR</p>
    </div>
      <div class="acme-tier">
      <h3>Team</h3>
      <p>49.00 EUR</p>
    </div>
  </section>
```

With no data at all, the field default applies and the block renders
`From 19.00 EUR` with no tiers. Twig and Blade read the same value as
`a.price.amount` and `$a['price']['amount']`, and
[extension](/docs/extensions) templates can address it as
`{attributes.price.amount}`.

## Storage and the REST schema

Both fields declare `postMeta` storage, so Blockstudio registers two meta keys
when it builds the block. The top-level field uses the registered storage
schema as is:

```json
{
  "type": "object",
  "single": true,
  "show_in_rest": {
    "schema": {
      "type": "object",
      "properties": {
        "amount": { "type": "number", "minimum": 0 },
        "currency": { "type": "string", "pattern": "^[A-Z]{3}$" }
      },
      "additionalProperties": false
    }
  }
}
```

The field inside the repeater stores one value per row, so its meta key is
array-backed and the same schema becomes the item schema:

```json
{
  "type": "array",
  "single": true,
  "show_in_rest": {
    "schema": {
      "type": "array",
      "items": {
        "type": "object",
        "properties": {
          "amount": { "type": "number", "minimum": 0 },
          "currency": { "type": "string", "pattern": "^[A-Z]{3}$" }
        },
        "additionalProperties": false
      }
    }
  }
}
```

Saving a post that contains the block syncs both keys. With the two tiers from
above, `get_post_meta( $id, 'acme_price', true )` returns
`{"amount":19,"currency":"EUR"}` and `acme_tier_prices` returns the list of
row prices:

```json
[
  { "amount": 19, "currency": "EUR" },
  { "amount": 49, "currency": "EUR" }
]
```

Both keys appear in the post's REST response under `meta`, and REST writes are
validated against the schema. A write with a lowercase currency is rejected:

```json
{
  "code": "rest_invalid_pattern",
  "message": "meta.acme_price[currency] does not match pattern ^[A-Z]{3}$.",
  "data": { "status": 400 }
}
```

Meta is a copy. The block attributes in the post content remain the source,
and every save syncs them to the configured keys again, so a value written to
meta directly is replaced the next time the post is saved. Option storage works
the same way through `register_setting()`. Custom field types, including
array-backed storage inside repeaters, are available since Blockstudio 7.5.0.

## Static analysis

The [PHPStan extension](/docs/dev/phpstan) knows the built-in field types, not
the ones a project registers at runtime. On a block that uses `acme/price` it
reports the field type as unknown and types its value as `mixed`:

```text
  2      block.json field "price" has unknown type "acme/price" in
         blockstudio/pricing/block.json
         🪪  blockstudio.blockJson.type
```

Ignore that diagnostic for your own types in the project configuration, and
keep the narrowing in the template, which is what PHPStan needs to accept the
`mixed` value at level `max`:

```neon title="phpstan.neon"
parameters:
    level: max
    ignoreErrors:
        -
            identifier: blockstudio.blockJson.type
            message: '#unknown type "acme/price"#'
```

With that configuration and the template above, the analysis passes. On 7.6
the template also needs the `@var` line, with `mixed` in the positions of the
custom fields; Blockstudio 7.7 infers that shape on its own and the line can
go. See [Checked Templates with PHPStan](/guides/analysis-and-agents) for
running the analysis.

## Next steps

- [Custom Field Types](/docs/blocks/attributes/custom-field-types): every
  definition key, the filter API, and the full list of component props.
- [Storage](/docs/blocks/storage): post meta and option storage for any field.
- [Field Patterns Cookbook](/guides/field-patterns): groups, repeaters, and
  reusable field structures.
- [Custom Fields](/docs/blocks/attributes/custom-fields): reusable field
  groups through `custom/{name}`.
