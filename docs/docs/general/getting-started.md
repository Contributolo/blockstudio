---
title: Getting Started
description: Set up your first Blockstudio project.
path: "general/getting-started"
order: 1
section: "Start"
subsection: "Setup"
meta_title: "Getting Started"
meta_description: "Set up your first Blockstudio project."
---

# Getting Started

This guide will help you set up Blockstudio and create your first custom block.

## Installation

### Via Composer (Recommended)

```bash
composer require blockstudio/blockstudio
```

Blockstudio can be installed as a plugin via `composer/installers` or bundled directly inside a theme. See the [Composer documentation](/docs/dev/composer) for all installation methods.

Composer installations receive updates through Composer. The built-in GitHub updater is automatically disabled.

### Manual Installation

[Download the latest release from GitHub](https://github.com/inline0/blockstudio/releases)

Upload the zip to your WordPress plugins directory and activate the plugin. Manual installations receive automatic update notifications in the WordPress dashboard via the built-in GitHub updater.

Both installation methods bundle private copies of the Markdown, YAML, and
updater libraries and their dependencies. They do not use or replace versions
provided by another plugin or theme. Install your own Composer dependency if
your application uses one of those libraries directly; Blockstudio's bundled
copies are internal, not a public PHP API.

### Authenticated Update Checks

Manual installations check GitHub anonymously by default. Several sites sharing
one outbound IP can exhaust GitHub's anonymous API allowance and receive HTTP
403 responses when checking for updates. From 7.7.4, configure a GitHub personal
access token in `wp-config.php`, before WordPress loads:

```php title="wp-config.php"
define('BLOCKSTUDIO_GITHUB_TOKEN', 'your-github-token');
```

The token only needs access to public repository information. Do not grant write
permissions. Keep it in server-side configuration, out of version control and
out of `blockstudio.json`, block attributes, and frontend code. The updater
passes it to its bundled GitHub client for authenticated checks and release
downloads. Requests to unrelated repositories and other download hosts do not
receive the token.

For environment-managed secrets, an MU plugin can supply or override the token:

```php title="wp-content/mu-plugins/blockstudio-updater.php"
<?php
add_filter('blockstudio/updater/token', function ($token) {
  return getenv('BLOCKSTUDIO_GITHUB_TOKEN') ?: $token;
});
```

The filter runs when Blockstudio initializes its updater, before the theme
loads. Register it in an MU plugin rather than `functions.php`. Returning an
empty string disables authentication even when the constant is defined. Empty
or non-string values leave checks anonymous. Tokens are optional; without one,
existing update behavior is unchanged. Composer installations still use
Composer for updates and do not initialize this updater.

## Creating Your First Block

### 1. Create a Block Directory

Create a new directory in your theme:

```
my-theme/
  blockstudio/
    my-first-block/
      block.json
      index.php
```

### 2. Define the Block Schema

Create `block.json` with your block configuration:

```json title="block.json"
{
  "$schema": "https://blockstudio.dev/schema/block",
  "name": "my-theme/my-first-block",
  "title": "My First Block",
  "category": "common",
  "icon": "star-filled",
  "blockstudio": {
    "attributes": [
      {
        "id": "heading",
        "type": "text",
        "label": "Heading",
        "default": "Hello World"
      },
      {
        "id": "content",
        "type": "textarea",
        "label": "Content"
      }
    ]
  }
}
```

### 3. Create the Template

Create `index.php` for rendering:

```php title="index.php"
<div class="my-first-block">
  <h2><?php echo $a['heading']; ?></h2>
  <p><?php echo $a['content']; ?></p>
</div>
```

## Using Twig Templates

Blockstudio supports Twig templates out of the box. Simply use `index.twig` instead:

```twig title="index.twig"
<div class="my-first-block">
  <h2>{{ a.heading }}</h2>
  <p>{{ a.content }}</p>
</div>
```

## Adding Styles

Create a `style.css` file in the same folder:

```css title="style.css"
.my-first-block {
  padding: 2rem;
  background: #f5f5f5;
}
```

Blockstudio will automatically enqueue this stylesheet when the block is used.

## Translations

Blockstudio's editor controls and admin overview load JavaScript translations
for the `blockstudio` text domain through WordPress. Install a matching
language pack or generate script translation JSON files with your translation
tool in `wp-content/languages/plugins/`. Strings without an available
translation remain in English. This translates Blockstudio's own interface,
not the content or field labels you define in your blocks.

## Next Steps

Your block is now ready to use in the WordPress editor. Continue exploring the documentation to learn about:

- [Field Types](/docs/blocks/attributes/field-types) - All available field types
- [Components](/docs/blocks/react-components/innerblocks) - InnerBlocks, RichText, and more
- [Tailwind Integration](/docs/tailwind) - Using Tailwind CSS
- [Hooks](/docs/blocks/hooks/php) - Extending functionality with filters and actions


> **[Building a Block Library](/guides/block-library)**
>
> Go from a single block to a full library: design tokens, the section pattern, repeaters, images, and page composition.
