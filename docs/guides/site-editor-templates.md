---
title: Site Editor Templates and Parts from Files
description: Author block theme templates and template parts as Blockstudio folders with a manifest and HTML-like markup, compiled to native block markup while the Site Editor keeps its customize and reset workflow.
path: "site-editor-templates"
order: 11
section: "Guides"
meta_title: "Site Editor Templates and Parts from Files"
meta_description: "Author block theme templates and template parts as Blockstudio folders with a manifest and HTML-like markup, compiled to native block markup while the Site Editor keeps its customize and reset workflow."
---

# Site Editor Templates and Parts from Files

A block theme describes its layout in `templates/*.html` and `parts/*.html`:
files full of serialized block comments such as
`<!-- wp:template-part {"slug":"header"} /-->`. Nobody enjoys writing those by
hand, so they usually get built in the Site Editor and exported. That works
until two people edit the same template, or a reviewer has to read a diff of
escaped JSON in HTML comments.

Blockstudio lets you write the same templates the way you write file-based
pages: a folder with a small JSON manifest and a source file in HTML-like
markup, using plain elements, `<block>` tags, and your own Blockstudio blocks.
Blockstudio compiles the source to native block markup and hands it to WordPress
as a theme file. The Site Editor still works exactly as before: users can
customize a template, and resetting it brings back the file version.

This guide builds a header and footer part, front page and single templates,
and a custom template that editors can pick for pages, then shows how WordPress
resolves them.

## Folder Structure

Templates go in `templates/`, template parts in `parts/`. Each one is a folder
with a manifest and one source file:

```
theme/
├── templates/
│   ├── front-page/
│   │   ├── template.json
│   │   └── index.php
│   ├── single/
│   │   ├── template.json
│   │   └── index.php
│   └── page-landing/
│       ├── template.json
│       └── index.php
└── parts/
    ├── header/
    │   ├── part.json
    │   └── index.php
    └── footer/
        ├── part.json
        └── index.html
```

These are the same `templates/` and `parts/` folders WordPress reads for a block
theme. Blockstudio scans the active theme first and then the parent theme.
Folders with a `template.json` or `part.json` are Blockstudio sources; plain
`.html` files next to them stay native WordPress templates.

The source file can be `index.php`, `index.blade.php`, `index.twig`, or
`index.html`, checked in that order. Twig requires Timber and Blade requires its
renderer package, as described in
[Template Engines](/docs/pages-and-patterns#template-engines).

## Step 1: The Header Part

Every part needs a `part.json`. The `area` tells the Site Editor where the part
belongs:

```json title="parts/header/part.json"
{
  "slug": "header",
  "title": "Header",
  "description": "Site header with logo and navigation",
  "area": "header"
}
```

The source uses the same syntax as Blockstudio pages and patterns. A `<div>`
becomes a group block, attributes become block attributes, and `<block>`
elements produce any registered block:

```php title="parts/header/index.php"
<div layout='{"type":"flex","justifyContent":"space-between"}'>
  <block name="core/site-title" />
  <block name="core/navigation" overlayMenu="mobile" />
</div>
```

Blockstudio compiles it to this block markup:

```html
<!-- wp:group {"layout":{"type":"flex","justifyContent":"space-between"}} --><div class="wp-block-group is-layout-flex"><!-- wp:site-title /--><!-- wp:navigation {"overlayMenu":"mobile"} /--></div><!-- /wp:group -->
```

That is what you would otherwise have written by hand. Your own blocks work the
same way: `<block name="acme/announcement" />`, a `<bs:acme-announcement />`
tag, or a configured tag prefix all compile to the block comment for that
block.

## Step 2: The Footer Part

A part can be as small as one paragraph. This one uses `index.html` to make the
point that the source is markup, not a program:

```json title="parts/footer/part.json"
{
  "slug": "footer",
  "title": "Footer",
  "area": "footer"
}
```

```html title="parts/footer/index.html"
<p>Built with Acme.</p>
```

It compiles to `<!-- wp:paragraph --><p>Built with Acme.</p><!-- /wp:paragraph -->`.

## Step 3: Front Page and Single Templates

Templates use `template.json`. The `slug` must be an exact WordPress template
hierarchy name such as `front-page`, `single`, `page`, `archive`, `404`, or
`single-product`. Blockstudio never prefixes it.

```json title="templates/front-page/template.json"
{
  "slug": "front-page",
  "title": "Front Page",
  "description": "Homepage template"
}
```

```php title="templates/front-page/index.php"
<block name="core/template-part" slug="header" tagName="header" />

<main>
  <block name="core/post-content" />
</main>

<block name="core/template-part" slug="footer" tagName="footer" />
```

The single post template follows the same shape with post blocks:

```json title="templates/single/template.json"
{
  "slug": "single",
  "title": "Single Post"
}
```

```php title="templates/single/index.php"
<block name="core/template-part" slug="header" tagName="header" />

<main>
  <block name="core/post-title" level="1" />
  <block name="core/post-date" />
  <block name="core/post-content" />
</main>

<block name="core/template-part" slug="footer" tagName="footer" />
```

The compiled single template:

```html
<!-- wp:template-part {"slug":"header","tagName":"header"} /--><!-- wp:group {"tagName":"main"} --><main class="wp-block-group"><!-- wp:post-title {"level":1} /--><!-- wp:post-date /--><!-- wp:post-content /--></main><!-- /wp:group --><!-- wp:template-part {"slug":"footer","tagName":"footer"} /-->
```

`<main>` became a group block with `tagName: "main"`, and the template part
blocks reference the parts from steps 1 and 2 by slug. When WordPress renders
the template, those references resolve to the file-backed parts, so the front
page output starts with
`<header class="wp-block-template-part">` containing the site title and
navigation, and ends with `<footer class="wp-block-template-part">` containing
the footer paragraph.

## Step 4: A Custom Template for Pages

Templates whose slug is not part of the hierarchy are custom templates. List
the post types they apply to with `postTypes`, and editors can choose them in
the template selector:

```json title="templates/page-landing/template.json"
{
  "slug": "page-landing",
  "title": "Landing Page",
  "description": "Full-width page without a header",
  "postTypes": ["page"]
}
```

```php title="templates/page-landing/index.php"
<main>
  <block name="core/post-content" />
</main>

<block name="core/template-part" slug="footer" tagName="footer" />
```

`get_block_templates( array( 'post_type' => 'page' ), 'wp_template' )` now
includes `page-landing`, and the template object carries
`post_types: ["page"]`.

## Sources Are Compiled Once

The source is read and compiled to block markup once, not per request. It has
no current post and no request context. `index.php` is read as markup: PHP code
in it is not executed, so `<?php echo get_bloginfo( 'name' ); ?>` compiles to
nothing. Everything that depends on the request belongs in a block that renders
at runtime: `core/site-title` instead of an echoed site name, `core/post-title`
instead of `the_title()`, or a dynamic Blockstudio block of your own.

Compiled results are cached with file-watch metadata. Editing a manifest or a
source file invalidates the cached content for that item, so the next request
sees the change without a separate build step.

## How WordPress Sees the Files

Blockstudio plugs into the same lookups WordPress uses for theme templates. In
`get_block_templates()` the file-backed templates appear with
`source: "theme"` and `origin: "theme"`, just like native theme files, and
`get_block_template( 'acme//header', 'wp_template_part' )` returns the header
part with its `area`.

The lookup order is:

1. A Site Editor customization stored in the database.
2. A native `.html` file in the active theme.
3. The Blockstudio file-backed source.
4. Parent theme or plugin fallbacks.

That order keeps the Site Editor workflow intact. When a user edits the footer
and saves, WordPress stores a `wp_template_part` post, and
`get_block_template()` returns that customization with `source: "custom"`.
Later changes to `parts/footer/index.html` do not show up while the
customization exists. When the user resets the part, or the post is deleted,
the lookup falls back to the file and returns the latest compiled source again.

Blockstudio does not write Site Editor edits back to files. If a user's change
should become the new default, copy it into the source file and reset the
customization.

## Nested index.html and Slugs

WordPress discovers `.html` files in `templates/` and `parts/` recursively. A
manifest folder that uses `index.html`, such as `parts/footer/index.html`, would
therefore also appear as a native part with the path-derived slug
`footer/index`. Since Blockstudio 7.6.6, a manifest-owned `index.html` is
exposed only under its declared slug, so the Site Editor lists one footer, not
two. Nested `.html` files without a manifest are left alone.

## Checking Templates from PHP

The `Blockstudio\Site_Templates` class reads and compiles the sources, which is
useful in tests and deployment checks:

```php
$templates = Blockstudio\Site_Templates::templates();
$header    = Blockstudio\Site_Templates::get_part( 'header' );

echo $header['area'];    // header
echo $header['content']; // compiled block markup

$errors = Blockstudio\Site_Templates::errors();
```

Each item includes `slug`, `title`, `description`, `type` (`wp_template` or
`wp_template_part`), `status`, `source_type`, `postTypes` for templates or
`area` for parts, `meta`, and the compiled `content`. Pass a list to compile
only selected items, and read problems for that selection with
`selection_errors()`:

```php
$selected = Blockstudio\Site_Templates::templates( array( 'front-page' ) );
$errors   = Blockstudio\Site_Templates::selection_errors( 'templates' );
```

## Adding Other Folders

To keep Blockstudio sources apart from native templates, or to ship them from a
plugin, add discovery roots with filters:

```php title="functions.php"
add_filter( 'blockstudio/site_templates/template_paths', function ( $paths ) {
	$paths[] = get_stylesheet_directory() . '/site-templates';
	return $paths;
} );

add_filter( 'blockstudio/site_templates/part_paths', function ( $paths ) {
	$paths[] = get_stylesheet_directory() . '/site-parts';
	return $paths;
} );
```

The `blockstudio/site_templates/template_content` and `part_content` filters
adjust a source before it is parsed, and `blockstudio/site_templates/parser`
swaps the parser for one item. The full list is in the
[Site Templates hooks table](/docs/pages-and-patterns/site-templates#hooks).

## When to Use What

| You want | Use |
| --- | --- |
| The theme layout WordPress picks for a URL: header, footer, single, archive | Site templates and parts |
| A routable page whose content lives in files | [File-based pages](/guides/file-based-pages) |
| A reusable section editors insert | [Patterns](/docs/pages-and-patterns/patterns) |

Templates do not create posts. Pages do. A documentation section, for example,
is a page collection whose posts render through a template you can still author
here.

## Next Steps

- [Site Templates reference](/docs/pages-and-patterns/site-templates): every
  manifest property, the PHP API, and all hooks.
- [Pages & Patterns overview](/docs/pages-and-patterns): the HTML parser, block
  tags, and element mapping used by template sources.
- [Building a Documentation Site](/guides/documentation-site): page collections
  with Markdown, loaders, and layouts.
