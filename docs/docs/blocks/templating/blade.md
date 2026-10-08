---
title: Blade
description: Use Laravel Blade templates for your Blockstudio blocks.
path: "blocks/templating/blade"
order: 7
section: "Blocks"
subsection: "Templating"
meta_title: "Blade"
meta_description: "Use Laravel Blade templates for your Blockstudio blocks."
---

# Blade

Blade is a templating engine used primarily with the Laravel framework. It enables developers to create expressive, clean templates using a syntax that extends PHP in a simple and intuitive way. Blade templates facilitate common tasks like data display and layout management, helping streamline the development of dynamic web pages.

## Setup

To use Blade templates with Blockstudio, install Laravel's `illuminate/view` package with Composer. Versions 8 through 12 work.

```bash title="Terminal"
composer require illuminate/view
```

Next, add a filter to your theme's `functions.php` file to tell Blockstudio how to render Blade templates. Blockstudio automatically collects all Blade templates and maps their paths, allowing you to use Blade's dot syntax for includes and layouts. `Blockstudio\Blade_Renderer` assembles the view factory from `illuminate/view` and caches compiled views in the system temporary directory.

```php title="functions.php"
add_filter(
    "blockstudio/blocks/render",
    function ($value, $block) {
        $blockPath = $block->path;
        if (str_ends_with($blockPath, ".blade.php")) {
            if (!Blockstudio\Blade_Renderer::available()) {
                return 'Error: Blade is not installed. Please run "composer require illuminate/view".';
            }
            $data = $block->blockstudio["data"];
            $bladeData = $data["blade"];

            return Blockstudio\Blade_Renderer::render(
                $bladeData["path"],
                $bladeData["templates"][$block->name],
                [
                    "a" => $data["attributes"],
                    "attributes" => $data["attributes"],
                    "b" => $data["block"],
                    "block" => $data["block"],
                    "c" => $data["context"],
                    "context" => $data["context"],
                ]
            );
        }

        return $value;
    },
    10,
    2
);
```

The `jenssegers/blade` wrapper that earlier versions of this page used fails with `illuminate/view` 10 and later ("Target class [blade.compiler] does not exist"). If it is installed, `Blade_Renderer` uses the `illuminate/view` package it brought along instead.

## Template Variables

Your Blade templates will have access to the following variables:

| Variable | Description |
|----------|-------------|
| `$a` | An alias for `$attributes` |
| `$attributes` | The block's attributes |
| `$b` | An alias for `$block` |
| `$block` | Data related to the block itself |
| `$c` | An alias for `$context` |
| `$context` | The block's context (e.g., post ID, post type when in a loop) |

## Usage

To use Blade for your block's template, create an `index.blade.php` file in your block's directory. Blockstudio will then automatically use this file for rendering the block.

```php title="index.blade.php"
<div class="my-block">
  @if($a['title'])
    <h2>{{ $a['title'] }}</h2>
  @endif

  @if($a['content'])
    <p>{{ $a['content'] }}</p>
  @endif
</div>
```
