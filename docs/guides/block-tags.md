---
title: Composing Templates with Block Tags
description: Write blocks as HTML tags inside templates and page sources, add project prefixes for shorter names, and migrate shorthands back to the portable canonical spelling.
path: "block-tags"
order: 9
section: "Guides"
meta_title: "Composing Templates with Block Tags"
meta_description: "Write blocks as HTML tags inside templates and page sources, add project prefixes for shorter names, and migrate shorthands back to the portable canonical spelling."
---

# Composing Templates with Block Tags

Once a project has a handful of blocks, templates start to need each other. A
features block wants to print three cards. A landing page wants a section with
a button inside it. You can call `bs_render_block()` for each one, but a
template full of PHP calls with nested arrays is hard to read and harder to
nest.

Block tags let you write a block where its output belongs, as an HTML tag:

```html
<bs:acme-card title="Fast" text="Rendered on the server." />
```

The same tag means two different things depending on where it is written. In
a block template or in post content it is replaced with the rendered HTML of
the block. In a page, pattern, or Site Template source it becomes a real
WordPress block that appears in the editor. This guide builds a few blocks,
composes them both ways, adds a project prefix for shorter names, and then
shows how to migrate those shorthands back to the portable spelling.

## The blocks

Three small blocks are enough. A card with two fields:

```json title="blockstudio/card/block.json"
{
  "$schema": "https://blockstudio.dev/schema/block",
  "apiVersion": 3,
  "name": "acme/card",
  "title": "Card",
  "blockstudio": {
    "attributes": [
      { "id": "title", "type": "text", "label": "Title", "default": "" },
      { "id": "text", "type": "textarea", "label": "Text", "default": "" }
    ]
  }
}
```

```php title="blockstudio/card/index.php"
<article useBlockProps class="acme-card">
  <h3><?php echo esc_html( $a['title'] ); ?></h3>
  <p><?php echo esc_html( $a['text'] ); ?></p>
</article>
```

A section that wraps whatever is placed inside it, with a `heading` field
declared the same way as the card's:

```php title="blockstudio/section/index.php"
<section useBlockProps class="acme-section">
  <h2><?php echo esc_html( $a['heading'] ); ?></h2>
  <InnerBlocks />
</section>
```

And a button in a second namespace, `acme-ui/button`, with `label` and `href`
fields:

```php title="blockstudio/ui-button/index.php"
<a useBlockProps class="acme-button" href="<?php echo esc_url( $a['href'] ); ?>"><?php echo esc_html( $a['label'] ); ?></a>
```

## Tags inside a block template

Block templates render tags automatically. No setting is needed. A features
block can print two cards and a core separator directly:

```php title="blockstudio/features/index.php"
<div useBlockProps class="acme-features">
  <bs:acme-card title="Fast" text="Rendered on the server." />
  <block name="acme/card" title="Typed" text="Fields come from block.json." />
  <block name="core/separator" />
</div>
```

Rendering `acme/features` produces:

```html
<!--blockstudio/acme/features--><div class="acme-features wp-block-acme-features">
  <!--blockstudio/acme/card--><article class="acme-card wp-block-acme-card">
  <h3>Fast</h3>
  <p>Rendered on the server.</p>
</article>

  <!--blockstudio/acme/card--><article class="acme-card wp-block-acme-card">
  <h3>Typed</h3>
  <p>Fields come from block.json.</p>
</article>

  <hr class="wp-block-separator has-alpha-channel-opacity">
</div>
```

Each Blockstudio block in the output is preceded by a
`<!--blockstudio/namespace/slug-->` comment. The page buffer removes it from the
response; for output that skips the buffer, use
[`bs_strip_render_markers()`](/docs/blocks/rendering#rendering-outside-the-page).
The two syntaxes are equivalent. `<bs:acme-card>` encodes the block name in
the tag, and `<block name="acme/card">` passes it as an attribute. Every other
attribute becomes a field value, so `title` reaches the card template as
`$a['title']`. Core blocks work too, rendered through WordPress with the
built-in block renderers.

### Paired tags and inner content

A paired tag passes its children to the block. For a Blockstudio block they
fill `<InnerBlocks />`, and tags nested inside are rendered first:

```html
<bs:acme-section heading="Why Acme">
  <bs:acme-card title="Fast" text="Rendered on the server." />
  <bs:acme-ui-button label="Get started" href="/start" />
</bs:acme-section>
```

```html
<!--blockstudio/acme/section--><section class="acme-section wp-block-acme-section">
  <h2>Why Acme</h2>
  <div>
  <!--blockstudio/acme/card--><article class="acme-card wp-block-acme-card">
  <h3>Fast</h3>
  <p>Rendered on the server.</p>
</article>

  <!--blockstudio/acme-ui/button--><a class="acme-button wp-block-acme-ui-button" href="/start">Get started</a>

</div>
</section>
```

### How a tag name becomes a block name

A `<bs:>` tag name has no slash, so Blockstudio finds one. It replaces each
hyphen with a slash in turn, from left to right, and uses the first candidate
that is registered. `<bs:acme-card>` resolves to `acme/card` on the first try.
`<bs:acme-ui-button>` tries `acme/ui-button`, finds nothing, and then resolves
`acme-ui/button`. Namespaces that contain hyphens therefore work without any
configuration, as long as the two candidates do not both exist.

## Shorter names with prefixes

`<bs:acme-ui-button>` is precise but long. A project prefix maps a short tag
prefix to one or more namespaces. Configure it in `blockstudio.json`:

```json title="blockstudio.json"
{
  "$schema": "https://blockstudio.dev/schema/blockstudio",
  "blockTags": {
    "prefixes": {
      "acme": ["acme"],
      "ui": ["acme-ui"]
    }
  }
}
```

Or register the same map from PHP:

```php title="functions.php"
add_filter( 'blockstudio/block_tags/prefixes', function ( $prefixes ) {
	$prefixes['acme'] = array( 'acme' );
	$prefixes['ui']   = array( 'acme-ui' );

	return $prefixes;
} );
```

Now `<acme-card>` resolves to `acme/card`, and `<ui-button>` to
`acme-ui/button`. When a prefix lists several namespaces, they are tried in
order and the first registered block wins, which lets a project block shadow a
library block of the same slug.

Prefixes also compose. `<acme-ui-button>` first tries `acme/ui-button`. That
block does not exist, and the rest of the tag, `ui-button`, is itself a
registered prefix tag, so resolution falls through to `acme-ui/button`. A
direct match always wins over the nested one.

```html
<bs:acme-section heading="Why Acme">
  <acme-card title="Fast" text="Rendered on the server." />
  <acme-ui-button label="Get started" href="/start" />
</bs:acme-section>
```

This renders exactly the same HTML as the canonical version above.

A few rules apply to prefixes:

- A prefix is lowercase letters and numbers, starts with a letter, and contains
  no dashes.
- A prefixed tag that resolves to no registered block is left in the output
  untouched, so `<acme-missing title="x" />` stays as written.
- Exact aliases from the `blockstudio/block_tags/tag_aliases` filter take
  precedence over prefixes. An alias maps one dashed tag to one block, for
  example `$aliases['acme-cta'] = 'acme-ui/button';` makes `<acme-cta>` render
  the button.

Prefix and alias tags render in block templates alongside `<bs:>` and `<block>`
tags from Blockstudio 7.5.

## Attributes

Attributes that match a field ID become field values. Two prefixes do
something else:

- `data-*` attributes are copied onto the root element of the rendered block.
- `html-*` attributes are copied onto the root element with the prefix
  stripped, so `html-id="intro"` becomes `id="intro"`.

```html
<bs:acme-card title="Hi" text="There" data-track="card" html-id="intro" html-class="featured" />
```

```html
<article data-track="card" id="intro" class="featured">
  <h3>Hi</h3>
  <p>There</p>
</article>
```

`html-class` sets the attribute, it does not append to it: the block's own
`acme-card wp-block-acme-card` classes are gone. If a caller should add classes
to a block, declare a field for them and merge it in the template.

Any other attribute that is not a declared field is dropped. A plain
`class="wide"` on `<bs:acme-card>` renders the card without it. Blockstudio 7.7
reports such attributes with a `_doing_it_wrong()` notice when `WP_DEBUG` is on.

## The same tags in page sources

In [file-based pages](/guides/file-based-pages), patterns, and Site Templates,
tags are not rendered. They are converted to blocks when the source is parsed,
so they show up in the editor. This page source:

```html title="pages/home/index.php"
<bs:acme-section heading="Why Acme">
  <p>Everything below is a real block.</p>
  <acme-card title="Fast" text="Rendered on the server." />
  <acme-ui-button label="Get started" href="/start" />
</bs:acme-section>
```

parses to this block markup (line breaks added for reading):

```html
<!-- wp:acme/section {"blockstudio":{"attributes":{"heading":"Why Acme"}}} -->
<!-- wp:paragraph --><p>Everything below is a real block.</p><!-- /wp:paragraph -->
<!-- wp:acme/card {"blockstudio":{"attributes":{"title":"Fast","text":"Rendered on the server."}}} /-->
<!-- wp:acme-ui/button {"blockstudio":{"attributes":{"label":"Get started","href":"/start"}}} /-->
<!-- /wp:acme/section -->
```

Field values land under `blockstudio.attributes`, which is where Blockstudio
blocks keep them, and the paragraph and both inner blocks become inner blocks
of the section. Prefixes and aliases resolve here exactly as they do in
templates.

## Tags in post content

Content written in the editor or stored in widgets is not scanned by default.
Enable page-level rendering in `blockstudio.json`:

```json title="blockstudio.json"
{
  "blockTags": {
    "enabled": true
  }
}
```

Tags in `the_content` and `widget_text` are then rendered at priority `5`. The
same switch registers a filter for rendering tags in any string:

```php
$html = apply_filters( 'blockstudio/block_tags/render', $content );
```

Restrict what tags may render with `allow` and `deny` patterns, which accept
`fnmatch()` wildcards and apply to every syntax and both rendering modes:

```json title="blockstudio.json"
{
  "blockTags": {
    "enabled": true,
    "deny": ["acme-ui/*"]
  }
}
```

With that rule in place, `<acme-ui-button>` and `<bs:acme-ui-button>` are left
in the output unrendered. `deny` takes precedence over `allow`. The
`blockstudio/block_tags/allow` and `blockstudio/block_tags/deny` filters change
the same lists from PHP.

## Analysis checks the canonical spelling

The [PHPStan extension](/docs/dev/phpstan#block-tag-validation) validates block
tags in PHP, Twig, and Blade templates. A misspelled field or block name is
reported with the block it resolved to:

```text
  3      Block tag "acme/card" has unknown attribute "txt" in index.php
         🪪  blockstudio.blockTag.attribute
  4      Block tag references unknown block "acme/cards" in index.php
         🪪  blockstudio.blockTag.unknown
```

On 7.6 this covers `<bs:>` and `<block>` tags. A prefix tag such as
`<acme-card txt="...">` passes unchecked. Blockstudio 7.7 extends the rule to
prefix tags, page sources, and mapped HTML elements, and its hint lists the
global attributes a tag may forward.

## Migrate shorthands to the canonical spelling

Prefix and alias tags are a project convenience. They only resolve where the
project's filters and settings are loaded, so a template copied into another
project, a block library, or a coding agent's context loses its meaning.
`<bs:namespace-slug>` records the real block name and resolves everywhere,
which is why Blockstudio's own examples, diagnostics, and generated output use
it.

A standalone command rewrites shorthands to that spelling. Take a project
whose sources still use the short forms, including an alias, a tag for a block
that no longer exists, and an example inside a code sample:

```php title="blockstudio/features/index.php"
<div useBlockProps class="acme-features">
  <acme-card title="Fast" text="Rendered on the server." />
  <acme-ui-button label="Get started" href="/start" />
</div>
```

```php title="pages/home/index.php"
<acme-section heading="Why Acme">
  <acme-cta label="Talk to us" href="/contact" />
  <acme-quote text="Missing block" />
</acme-section>
<pre><code>&lt;acme-card /&gt; <acme-card title="Example" /></code></pre>
```

The command does not load WordPress, so it takes the project's configuration
as JSON files kept outside the scanned tree:

```json title="/tmp/acme-tags/prefixes.json"
{ "acme": ["acme"], "ui": ["acme-ui"] }
```

```json title="/tmp/acme-tags/blocks.json"
["acme/card", "acme/section", "acme/features", "acme-ui/button"]
```

```json title="/tmp/acme-tags/aliases.json"
{ "acme-cta": "acme-ui/button" }
```

Start with a dry run, which is also the default:

```bash
php vendor/blockstudio/blockstudio/bin/migrate-block-tags.php \
  --root="$PWD" \
  --prefix-map=/tmp/acme-tags/prefixes.json \
  --known-blocks=/tmp/acme-tags/blocks.json \
  --aliases=/tmp/acme-tags/aliases.json \
  --report=/tmp/acme-tags/report.json \
  --dry-run
```

```text
Report: /tmp/acme-tags/report.json
Dry run: 2 files, 2 changed, 5 replacements, 1 unknown, 0 ambiguous, 1 manual.
```

The report lists every mapping it would apply and every case it will not
guess:

```json
{
  "mappings": [
    { "legacy": "acme-card", "canonical": "bs:acme-card", "block": "acme/card", "occurrences": 1 },
    { "legacy": "acme-cta", "canonical": "bs:acme-ui-button", "block": "acme-ui/button", "occurrences": 1 },
    { "legacy": "acme-section", "canonical": "bs:acme-section", "block": "acme/section", "occurrences": 2 },
    { "legacy": "acme-ui-button", "canonical": "bs:acme-ui-button", "block": "acme-ui/button", "occurrences": 1 }
  ],
  "unknown": [
    { "path": "pages/home/index.php", "line": 3, "column": 4, "tag": "acme-quote", "reason": "no-known-block" }
  ],
  "manual": [
    { "path": "pages/home/index.php", "line": 5, "column": 33, "tag": "acme-card", "reason": "code-sample" }
  ]
}
```

The report is trimmed here. It also records configuration and per-file
before and after hashes. The section's opening and closing tags count as two
occurrences. `acme-quote` matches the `acme` prefix but names no known block,
so it is unknown. The `acme-card` inside `<pre><code>` is an example, not
markup, so it is reported for manual review and never rewritten; the same
applies to HTML comments and inline code.

Applying is refused while unknown, ambiguous, or dynamic tags remain:

```text
Error: Unresolved tags remain; no files were written. Review a dry-run report or pass --allow-unresolved.
```

The command exits `2`. Fix the unknown tag, here by removing it, and run
with `--apply` instead of `--dry-run`:

```text
Applied: 2 files, 2 changed, 5 replacements, 0 unknown, 0 ambiguous, 1 manual.
```

Only tag names change. Attributes are preserved byte for byte:

```html title="pages/home/index.php"
<bs:acme-section heading="Why Acme">
  <bs:acme-ui-button label="Talk to us" href="/contact" />
</bs:acme-section>
```

Running the dry run again over the result reports
`0 changed, 0 replacements`. The prefixes can stay registered afterwards, so
nothing breaks while other branches still use the short form.

## Next steps

- [Rendering](/docs/blocks/rendering#block-tags): the complete tag syntax,
  custom renderers, and the parser.
- [Settings](/docs/general/settings): every `blockTags` option.
- [Building File-Based Pages](/guides/file-based-pages): page sources where
  tags become editable blocks.
- [Block Tag Migration](/docs/dev/cli#block-tag-migration): all options of
  the migration command.
- [Checked Templates with PHPStan](/guides/analysis-and-agents): running the
  analysis that validates tags.
