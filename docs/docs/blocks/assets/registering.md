---
title: Registering Assets
description: Automatically enqueue CSS and JavaScript files for your blocks.
path: "blocks/assets/registering"
order: 9
section: "Blocks"
subsection: "Assets"
meta_title: "Registering Assets"
meta_description: "Automatically enqueue CSS and JavaScript files for your blocks."
---

# Registering Assets

Blockstudio will automatically enqueue all files ending with `.css`, `.scss` and `.js` when your block is being used on a page. It is possible to define how assets are being enqueued by using one of the following file names. The `*` is a wildcard that can be replaced with any string of your choice.

Inside block CSS and SCSS files, `%selector%` expands to the block's scoped wrapper class. This lets you target the same element that receives `bs_get_scoped_class()`, even when the file is not a scoped asset.

| Pattern           | Behavior                                                                              |
| ----------------- | ------------------------------------------------------------------------------------- |
| `*.(s)css`        | Enqueues as a `<link>` tag in the editor and on the frontend                          |
| `*.inline.(s)css` | Enqueues contents in an inline `<style>` tag in the editor and on the frontend        |
| `*.editor.(s)css` | Enqueues as a `<link>` tag in the editor only                                         |
| `*.scoped.(s)css` | Enqueues scoped contents in an inline `<style>` tag in the editor and on the frontend |
| `*.js`            | Enqueues as a `<script>` tag in the editor and on the frontend                        |
| `*.inline.js`     | Enqueues contents in an inline `<script>` tag in the editor and on the frontend       |
| `*.editor.js`     | Enqueues as a `<script>` tag in the editor only                                       |
| `*.view.js`       | Enqueues as a `<script>` tag on the frontend only                                     |


> **Note**
>
> The dash notation (`*-inline.css`, `*-editor.css`, etc.) is still supported
> for backward compatibility but is deprecated. Use dot notation for new blocks.


## Inline

Inline styles and scripts have the big advantage that they are directly rendered as style or script tags inside the page. This can enhance loading times, since it saves extra requests that would have to be made otherwise.

- `.js` files are inlined to the end of the body
- `.(s)css` files are inlined to the end of the head
- Each file is only being inlined once

## Inline Small Stylesheets

A `*.(s)css` file is linked by default, which costs one request per file. The
`assets.inlineLimit` setting prints small stylesheets inline instead, following
the rule WordPress core applies to its own styles: the external block
stylesheets of a page are taken from smallest to largest and printed as
`<style>` while their running total stays within the limit. Every other file
keeps its `<link>` tag.

```json title="blockstudio.json"
{
  "assets": {
    "inlineLimit": 40000
  }
}
```

The limit is in bytes and `0`, the default, turns the behavior off. It
measures the compiled file that the `<link>` would load, minified when
`assets.minify.css` is on. Only the choice between `<link>` and `<style>`
depends on size. Each tag stays where the `<link>` would have been, so the load
order and the cascade are unchanged. The element keeps its `id`.

The setting does not apply to `*.inline.(s)css` and `*.scoped.(s)css` files,
which are always inline, to editor and admin assets, or to stylesheets
extracted from imported JavaScript modules. Global stylesheets count like block
stylesheets. A file stays linked
whenever inlining would change it:

- It holds a relative URL in `url()` or `@import`, which resolves against the
  stylesheet when linked and against the page when inline. Absolute paths,
  full URLs, `data:` URIs and `#` fragments are fine.
- It uses `image-set()` or contains a closing `</style` sequence.
- It contains CSS escapes, an HTML comment opener, or an `@charset` declaration.
  These files stay linked conservatively rather than risking changed URL or
  document parsing.

Use the setting filter to change the limit from PHP:

```php title="functions.php"
add_filter('blockstudio/settings/assets/inline_limit', fn() => 40000);
```

Inlined CSS becomes part of the page HTML. A page cache has to be purged after
a stylesheet changes, and the browser cannot cache those bytes between pages,
which is why the limit is a total per page.

## Scoped

Scoped styles are also inlined, but are prefixed with an ID that is unique to each block. Use the `bs_get_scoped_class` function to add the class to your template.

```php title="index.php"
<section class="hero <?php echo bs_get_scoped_class($b['name']); ?>">
  <h1 class="hero__title">Scope me!</h1>
</section>
```

```css title="style.scoped.css"
%selector% {
  --hero-gap: var(--wp--preset--spacing--space-10);
}

%selector%.hero {
  border-bottom: 1px solid currentColor;
}

.hero__title {
  color: red;
}
```

The above will result in the following scoped style:

```html
<style>
  .bs-62df71e6cc9a {
    --hero-gap: var(--wp--preset--spacing--space-10);
  }

  .bs-62df71e6cc9a.hero {
    border-bottom: 1px solid currentColor;
  }

  .bs-62df71e6cc9a .hero__title {
    color: red;
  }
</style>

<section class="hero bs-62df71e6cc9a">
  <h1 class="hero__title">Scope me!</h1>
</section>
```

Regular selectors inside a scoped file still target descendants of the scoped wrapper. Use `%selector%` when you want to style the wrapper itself.

## Global

Besides block specific assets, it is also possible to enqueue global assets, which will be available on all pages, regardless if a block is present. Enqueuing a global asset is done by adding the `global-` prefix to the file name. Any of the suffixes (e.g. `-inline`) can be used in combination.

Possible combinations are:

- `global-styles.(s)css`
- `global-styles.inline.(s)css`
- `global-styles.editor.(s)css`
- `global-styles.scoped.(s)css`
- `global-scripts.js`
- `global-scripts.inline.js`
- `global-scripts.editor.js`
- `global-scripts.view.js`

## Admin

Admin assets are enqueued only in the WordPress admin area. The `admin-` prefix is used to define admin assets.

- `admin-styles.(s)css`
- `admin-scripts.js`

## Block Editor

Block editor assets are enqueued only in the block editor. The `block-editor-` prefix is used to define block editor assets.

- `block-editor-styles.(s)css`
- `block-editor-scripts.js`


> **Note**
>
> If WordPress disables the editor iframe because a client-side block is
> registered with `apiVersion` lower than 3, the editor canvas and WordPress
> admin chrome share the same document. Global or editor scripts that bind to
> `window`, `document`, `body`, wheel events, or document scrolling should guard
> against `body.block-editor-page` or exclude WordPress editor regions such as
> `.interface-complementary-area` and `.interface-navigable-region`.


## Load Order

On the frontend, with automatic asset enqueuing and output buffering enabled,
Blockstudio adds its block CSS `<link>` and `<style>` tags to the buffered page
right before the closing `</head>` tag instead of registering them with
`wp_enqueue_style()`. Block CSS therefore comes after the stylesheets that
WordPress already printed in the head, including theme and plugin styles
enqueued with `wp_enqueue_style()`, regardless of their enqueue priority or
dependencies. Admin and `block-editor-` assets use WordPress's enqueue system
instead.

For rules with the same importance, cascade layer, and specificity, the block
stylesheet wins over a theme stylesheet. To change that, either raise the
specificity of the theme rule, or
append the theme stylesheet to the head Blockstudio generates with the
[`blockstudio/render/head`](/docs/blocks/hooks/php#head) filter. Content added
by the filter is placed after the block assets. Dequeue the stylesheet from
WordPress as well, so it is not loaded twice.

```php title="functions.php"
add_action('wp_enqueue_scripts', function() {
  wp_dequeue_style('theme-overrides');
}, 100);

add_filter('blockstudio/render/head', function($head) {
  return $head . '<link rel="stylesheet" href="' . esc_url(get_theme_file_uri('overrides.css')) . '">';
});
```

The `head` filter only runs when Blockstudio buffers the page. Buffering is off
in the Customizer preview and when
[`blockstudio/buffer/enabled`](/docs/blocks/hooks/php#enabled) returns `false`.
`bs_is_buffering()` tells you which case you are in, so a theme can append its
stylesheet through the filter when the page is buffered and enqueue it with
WordPress otherwise. The answer is available from `wp_enqueue_scripts` on and is
`false` before `template_redirect`.

```php title="functions.php"
add_action('wp_enqueue_scripts', function() {
  $url = get_theme_file_uri('overrides.css');

  if (bs_is_buffering()) {
    add_filter('blockstudio/render/head', function($head) use ($url) {
      return $head . '<link rel="stylesheet" href="' . esc_url($url) . '">';
    });
    return;
  }

  wp_enqueue_style('theme-overrides', $url);
});
```

Use [`blockstudio/buffer/output`](/docs/blocks/hooks/php#output) if you need to
rearrange the final document in a different way.

## Disable Enqueuing

Automatic asset enqueuing can be disabled using the `assets/enqueue` setting. This is useful if you want to handle all asset enqueuing by yourself.

```php title="functions.php"
add_filter('blockstudio/settings', function($settings) {
  $settings['assets']['enqueue'] = false;
  return $settings;
});
```

### Per Block

When a block templates returns nothing, Blockstudio will not enqueue any assets for that particular block. This method comes in handy to disable enqueueing when a certain condition is met.


#### PHP

```php title="index.php"
<?php
  if ( !$a['slides'] ) {
    // or return '';
    return false;
  }
?>

<div>my slider</div>
```

#### Twig

```twig title="index.twig"
{% if not a.slides %}
  <div>my slider</div>
{% endif %}
```
