---
title: Blockstudio 7.7
description: Virtual routes, targeted prerender builds, better editor behavior, and more reliable file-based content.
version: '7.7.0'
author: Dennis
path: 'blockstudio-7-7'
date: "2026-10-14"
order: 1
section: 'Blog'
meta_title: 'Blockstudio 7.7'
meta_description: 'Virtual routes, targeted prerender builds, better editor behavior, and more reliable file-based content.'
---

Blockstudio 7.7 adds virtual routes for documents without a WordPress post,
improves targeted prerender builds, and makes editing and rendering existing
blocks more reliable. It also expands PHPStan's block tag checks and improves
accessibility across the bundled UI components.

The file-first workflow stays the same. Blocks render from their templates,
and file-backed pages change through an explicit CLI or API synchronization.
This release does not introduce automatic page synchronization on visitor or
admin requests.

The short version:

- **Virtual routes**: serve a component gallery, catalog, or another complete
  document without creating a post or writing a custom redirect handler.
- **Targeted prerender builds**: HTTP builds record the source files each page
  uses, so a later build can render only affected routes.
- **Cache retention**: keep retired stylesheets available for cached pages and
  inspect or prune unused early-serve map entries.
- **Editor reliability**: multi-selected blocks keep their own values, undo
  and redo work for RichText and sidebar fields, and inherited context stays
  with the right block.
- **File content fidelity**: nested lists, sectioning elements, inline HTML,
  shortcodes, and escaped attributes survive parsing and rendering.
- **PHPStan improvements**: prefix tags, aliases, mapped page elements, and
  template variables are checked against the project's own definitions.
- **Accessible UI**: controls expose their state correctly, labels toggle the
  right input, and list and table components use valid HTML structure.
- **Translations**: installed JavaScript translations load in the editor and
  admin overview, including previously untranslated field controls.

## Virtual routes

Some pages come from data rather than an editor-owned post. A component
reference, for example, may need its own URL and document title but no entry
in `wp_posts`.

Register that document with `Blockstudio\Virtual_Routes`:

```php title="functions.php"
add_action('init', function () {
    Blockstudio\Virtual_Routes::register(
        'components',
        function () {
            get_header();
            echo bs_block([
                'name' => 'mytheme/card',
                'data' => ['heading' => 'Example card'],
            ]);
            get_footer();
        },
        ['title' => 'Component gallery']
    );
});
```

The route serves `/components/`. Its callback runs inside Blockstudio's output
buffer, so rendered blocks receive their styles, scripts, bundled UI assets,
and Tailwind output through the normal pipeline. WordPress does not turn the
matched route into a 404 or redirect it to a post.

For a family of URLs, set `prefix` to `true` and provide a `match` callback.
The callback receives the path below the route and returns the value your
renderer needs. Returning `null` or `false` leaves the request to WordPress.
Use `urls` to list the paths a static prerender build should include. A
single, non-prefix route includes its own path by default.

`Virtual_Routes::urls()` returns absolute URLs for integrations that assemble
a sitemap. It does not automatically add virtual documents to WordPress's
post sitemap.

See [Virtual Routes](/docs/pages-and-patterns/pages#virtual-routes) for the
complete API and options.

## More precise prerender builds

Graph-mode builds rendered over HTTP now record the files each route used:
the WordPress template, rendered block templates and assets, file-page
definitions and layouts, and dependencies added through
`blockstudio/render/dependencies`.

On the next build, `build_plan()` compares those dependencies. Changing a
block template marks its dependent routes for rendering without rebuilding
every unrelated page. Shared configuration changes still affect the whole
build, and new or expired routes are rendered as before.

Database-only changes are not file dependencies. A deployment that needs to
pick up an option, post, or other database value must force a build or
explicitly render the affected URLs.

The release also fixes build identities changing during the first render,
stale opcode-cached early-serve maps, and valid URLs being excluded simply
because their path contains `search` or `preview`. Markdown requests using
`Accept: text/markdown` bypass cached HTML, and the relevant responses send
`Vary: Accept`.

Static prerendering now honours filters registered by the active theme when
deciding whether to attach its hooks. A theme can disable the feature without
an earlier settings lookup leaving it active.

See [Static Prerendering](/docs/production/static-prerendering).

## Cache retention and maintenance

A cached HTML page can outlive the runtime identity that compiled its
stylesheet. `cache.namespaceGrace` controls how long retired namespaces remain
available after cleanup first discovers their retirement:

```json title="blockstudio.json"
{
  "cache": {
    "namespaceGrace": 777600
  }
}
```

This example retains retired files for nine days. The default is one day.
Currently active namespaces and namespaces serving deployed prerender
artifacts are protected from retirement cleanup.

The early-serve map also has inspection and cleanup commands:

```bash
wp bs prerender map status
wp bs prerender map prune --dry-run
wp bs prerender map prune
```

They report and remove entries for deleted sites or missing directories.
Deleting a multisite site removes its entries too. Missing route documents
are reported separately rather than causing an entire valid site entry to be
removed.

See [Caching](/docs/production/caching) for retention guidance and
[map maintenance](/docs/production/static-prerendering#warming-maintenance-and-observability) for the commands.

## A more reliable editor

Editing a multi-selected block now updates that block alone. Saving keeps
each block's own content, keys, metadata, and locks rather than copying
attributes between selected blocks.

RichText values live directly in block attributes, so Gutenberg can include
them in undo and redo. Sidebar fields participate in the same history.
`InnerBlocks templateLock="false"` is passed as a real boolean and unlocks
content even when an outer area is locked.

Initial preloads receive the edited post's ID and type, so templates can read
the correct metadata on the first render. Identical child blocks under
different parents keep separate inherited context in preloads and render
caches. Attribute or context changes during an initial request no longer
leave the preview behind.

Blockstudio also stops inserting hidden render-marker elements between block
roots. Adjacent-sibling selectors such as `.card + .card` now see the same
element relationships in the editor as on the frontend, while editor and
inserter preview renders remain separate.

## Safer site-wide option storage

Option-backed fields still provide site-wide values, but saving a post no
longer blindly writes every saved copy of those fields:

- Draft, pending, private, and scheduled saves do not write live site options.
- Published saves write supplied fields that changed in that edit.
- A title-only save of an old copy does not revert a newer site-wide value.
- Missing fields and removed blocks do not delete existing options.
- An explicit `null` removes an option. Empty strings, `false`, zero, and
  empty arrays remain valid values.

This is the main behavior change to check when upgrading. If an integration
used a private or draft post to update a live option, write that option
explicitly or use a published configuration post instead. Post-meta storage
is unaffected by the publish-only restriction.

See [Storage](/docs/blocks/storage) for the full save rules.

## File content stays intact

The HTML-to-block pipeline preserves more of the structure you wrote:

- Nested lists become inner list blocks of their parent item. List and item
  classes are preserved; ordinary flat lists keep their previous output.
- `main`, `header`, `footer`, `article`, and `aside` become group blocks that
  preserve their element instead of raw HTML that bypasses block rendering.
- Mapped richtext paragraphs keep inline markup, image-only paragraphs resolve
  to the mapped image block, and shortcode tags retain their content.
- Escaped attributes are decoded and escaped once, including attributes on
  `InnerBlocks`, `RichText`, and the `useBlockProps` element.
- Greater-than signs inside quoted self-closing tag attributes are accepted.
- Global HTML attributes reach a Blockstudio block's root when the block does
  not declare them as fields. `wp bs pages sync` reports stored attributes
  that are not rendered.

Blade-backed pages, patterns, and Site Editor templates now render through
`Blockstudio\Blade_Renderer`, supporting `illuminate/view` 8 through 12.
Extension files targeting the same block all register, and their priority,
group fields, and target lists follow the documented schema.

Nested SCSS dependencies are tracked too. Editing a partial imported by
another partial changes the dependent stylesheet's version and triggers
recompilation.

## PHPStan improvements

The separately installed `blockstudio/phpstan` package expands block tag
validation to prefix and alias tags, mapped page elements, layouts, bundled
UI blocks, and optionally other project PHP sources. Namespace resolution
matches the runtime, including namespaces containing hyphens, and forwarded
global HTML attributes are accepted.

Block template variables such as `$a`, `$block`, and `$context` are treated as
defined by Blockstudio. Field types survive null coalescing and `isset()`
under PHPStan 2.3, while a template that assigns its own `$a` keeps the type
it assigned.

These changes ship in `blockstudio/phpstan` 0.1.9. Update the package separately
from the plugin; it requires PHPStan 2.1.47 or newer:

```bash
composer require --dev blockstudio/phpstan:^0.1.9
```

See [PHPStan](/docs/dev/phpstan) for configuration and analysis presets.

## Accessibility and translations

Bundled UI triggers expose their expanded state on the actual button.
Checkbox, switch, and radio labels name and toggle their controls.
Breadcrumbs, pagination, navigation menus, and tables no longer insert
invalid wrapping elements between lists or tables and their children.

Password toggles expose their pressed state and have a larger click target.
Inputs accept `autocomplete`, and password inputs accept an explicit ID and
accessible label. Carousel viewports are keyboard-focusable, and spinner and
skeleton animations respect reduced-motion preferences.

The editor and admin overview load installed JavaScript translations for the
`blockstudio` text domain. Attribute menus and placeholders, code popup
actions, and image and file badges are now translatable. Strings without a
translation remain in English.

See the [UI library](/ui) and
[translation setup](/docs/general/getting-started#translations).

## Documentation and upgrading

The documentation adds guides for documentation sites, Content Sync, Site
Editor templates, block tags, islands, custom field types, deployment,
prerendering, registry setup, analysis tooling, and UI app screens. The ACF
migration guide reflects current ACF registration and Block Bindings.

Custom populate examples now use the supported single-argument,
named-dataset filter. Asset documentation explains frontend stylesheet order
and how to load theme overrides after block CSS. Contributor installations
use the public Font Awesome package without registry credentials.

PHP 8.2 and WordPress 6.7 remain the minimum requirements. Virtual routes and
the new maintenance commands are available without changing existing page
collections. Review the option-storage save rules above, update the separate
PHPStan package if you use it, and keep running page synchronization explicitly
as before.
