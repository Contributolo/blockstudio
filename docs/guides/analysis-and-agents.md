---
title: Checked Templates with PHPStan and a Generated AGENTS.md
description: Catch missing fields and unescaped output before they ship, gate commits on the result, and give coding agents a contract generated from your own project.
path: "analysis-and-agents"
order: 15
section: "Guides"
meta_title: "Checked Templates with PHPStan and a Generated AGENTS.md"
meta_description: "Catch missing fields and unescaped output before they ship, gate commits on the result, and give coding agents a contract generated from your own project."
---

# Checked Templates with PHPStan and a Generated AGENTS.md

A Blockstudio block is two files that have to agree. The `block.json` declares
the fields, and the template reads them as `$a['id']`. Nothing at runtime stops
the template from reading a key that was renamed, never declared, or misspelled.
It simply renders an empty string, and the mistake surfaces when someone notices
a blank heading on a live page. The same is true of output escaping: an
unescaped `echo` works perfectly until a field value contains markup.

The `blockstudio/phpstan` package moves both problems to analysis time. It
reads your `block.json` files, types `$a` from them, and reports template reads
that do not match. Its opt-in presets add theme structure rules, escaping, and
JavaScript and Tailwind checks. The same package ships two companions: a
managed pre-commit hook that runs the analysis, and a generator that writes an
`AGENTS.md` describing your project for coding agents.

This guide builds a small theme, breaks one of its templates on purpose, reads
the analysis output, fixes it, and then wires up the commit gate and the agent
contract.

## Set up the theme

Start with a theme folder that has a `style.css` header, a `composer.json`,
and one block:

```
acme/
├── blockstudio/
│   └── hero/
│       ├── block.json
│       └── index.php
├── blockstudio.json
├── composer.json
└── style.css
```

```css title="style.css"
/*
Theme Name: Acme
*/
```

Install the package as a development dependency:

```bash
composer require --dev blockstudio/phpstan
```

It pulls in PHPStan and the WordPress stubs from `szepeviktor/phpstan-wordpress`,
and installs three executables in `vendor/bin`: `blockstudio-phpstan`,
`blockstudio-githooks`, and `blockstudio-agents`.

Then tell the analysis what to run. Project-wide defaults live in the `phpstan`
object of `blockstudio.json`, so interactive runs, CI, and the commit hook all
read the same settings:

```json title="blockstudio.json"
{
  "$schema": "https://blockstudio.dev/schema/blockstudio",
  "phpstan": {
    "preset": "extreme-theme",
    "roots": ["."],
    "excludePaths": ["vendor/**"]
  },
  "githooks": {
    "commit": true
  }
}
```

`extreme-theme` is the strictest of the three static presets. The table further
down explains what each one adds. `excludePaths` keeps Composer's own files out
of the Blockstudio scan and out of PHP analysis.

## Break a template on purpose

The hero block declares a single field:

```json title="blockstudio/hero/block.json"
{
  "$schema": "https://blockstudio.dev/schema/block",
  "apiVersion": 3,
  "name": "acme/hero",
  "title": "Hero",
  "blockstudio": {
    "attributes": [
      { "id": "heading", "type": "text", "label": "Heading", "default": "" }
    ]
  }
}
```

The template reads that field correctly, then reads a `subtitle` the block
never declared and echoes it without escaping:

```php title="blockstudio/hero/index.php"
<section useBlockProps>
  <h1><?php echo esc_html( $a['heading'] ); ?></h1>
  <p><?php echo $a['subtitle']; ?></p>
</section>
```

In the editor and on the frontend, this renders an empty paragraph and no
error. Run the analysis instead:

```bash
vendor/bin/blockstudio-phpstan -- --no-progress
```

```text
 ------ -------------------------------------------------------------------
  Line   blockstudio/hero/index.php
 ------ -------------------------------------------------------------------
  2      Variable $a might not be defined.
         🪪  variable.undefined
  3      Dynamic Blockstudio attributes must be escaped before output.
         🪪  blockstudio.output.unescaped
  3      Field "subtitle" does not exist in block.json (block: acme/hero).
         🪪  blockstudio.field
  3      Offset 'subtitle' does not exist on array{heading: string}.
         🪪  offsetAccess.notFound
  3      Parameter #1 (mixed) of echo cannot be converted to string.
         🪪  echo.nonString
  3      Variable $a might not be defined.
         🪪  variable.undefined
 ------ -------------------------------------------------------------------

 [ERROR] Found 6 errors
```

The command exits with `1`. Reading the diagnostics from the most specific
down:

- `blockstudio.field` is the template rule. It found the `block.json` next to
  the template, resolved its fields, and `subtitle` is not one of them.
- `offsetAccess.notFound` is PHPStan itself reaching the same conclusion,
  because the extension gives `$a` the concrete shape `array{heading: string}`
  derived from `block.json`. Every field type maps to a PHP type: `text` is a
  `string`, `toggle` a `bool`, a repeater an array of row shapes.
- `blockstudio.output.unescaped` comes from the `extreme-theme` layer. Echoed
  attribute values must pass through an escaping function such as
  `esc_html()`, `esc_attr()`, `esc_url()`, or `wp_kses_post()`.
- `echo.nonString` follows from the unknown key: an offset that does not exist
  has no string type to echo.
- `variable.undefined` appears because PHPStan sees a template file, not the
  render function that defines `$a` before including it. The fix section
  covers it.

## Fix it

Decide whether `subtitle` is a real field. Here it is, so declare it, with a
`default` because the theme layer requires one on every field:

```json title="blockstudio/hero/block.json"
{
  "$schema": "https://blockstudio.dev/schema/block",
  "apiVersion": 3,
  "name": "acme/hero",
  "title": "Hero",
  "blockstudio": {
    "attributes": [
      { "id": "heading", "type": "text", "label": "Heading", "default": "" },
      { "id": "subtitle", "type": "textarea", "label": "Subtitle", "default": "" }
    ]
  }
}
```

Escape the output, and declare `$a` with the shape the extension infers:

```php title="blockstudio/hero/index.php"
<?php
/** @var array{heading: string, subtitle: string} $a */
?>
<section useBlockProps>
  <h1><?php echo esc_html( $a['heading'] ); ?></h1>
  <p><?php echo esc_html( $a['subtitle'] ); ?></p>
</section>
```

```bash
vendor/bin/blockstudio-phpstan -- --no-progress
```

```text
 [OK] No errors
```

Write the annotation as the exact shape. The canonical command runs PHPStan at
level `max`, where a looser `@var array<string, mixed> $a` is rejected with
`varTag.nativeType` ("PHPDoc tag @var with type array<string, mixed> is not
subtype of native type array{heading: string, subtitle: string}"). On 7.6 it
also widens every field to `mixed`, so each `esc_html()` call reports
`argument.type`. The `varTag.nativeType` message prints the inferred shape, so
it is also the quickest way to find the annotation to copy.

Blockstudio 7.7 treats `$a` as defined inside block templates, so the
`variable.undefined` diagnostics disappear and the annotation becomes
optional. Against 7.7, the broken template above reports four errors instead of
six, and the fixed template passes without the `@var` line.

## Choose a preset

Installing the package enables only the base extension. The canonical command
runs `base` unless a project selects another preset, so adding the dependency
never turns on the stricter layers by itself.

| Preset | Adds |
| --- | --- |
| `base` | Template field access in PHP, Twig, and Blade, block tag checks, schema validation for `block.json`, `field.json`, `page.json`, extension JSON, `db.php`, `rpc.php`, and `cron.php`, `Settings::get()` paths, and `blockstudio/*` hook names. |
| `theme` | Base plus theme roots and `style.css` headers, assets declared in `block.json` instead of enqueued by hand, `%selector%` scoping in `style.scss`, field defaults, and repeater bounds. |
| `extreme-theme` | Theme plus strict PHPStan flags, rejected shell and `eval()` calls, raw `$wpdb` writes, output escaping, Tailwind, JavaScript, and Interactivity API checks. |
| `wordpress-render` | Extreme theme plus a live render probe you supply as a command. |

When no project configuration is included, the canonical command runs `base`
and `theme` at PHPStan level `max` as well; `extreme-theme` sets `max` itself.
Every preset diagnostic has a stable `blockstudio.*` identifier, listed in the
[PHPStan reference](/docs/dev/phpstan#diagnostic-identifiers).

The theme and extreme layers look past PHP files. With a field missing its
`default` and a `script.js` that logs to the console, the same command
reports:

```text
 ------ -----------------------------------------------------------
  Line   blockstudio/hero/block.json
 ------ -----------------------------------------------------------
  1      Blockstudio field "subtitle" must define a default value.
         🪪  blockstudio.field.default
 ------ -----------------------------------------------------------

 ------ ------------------------------------------------------------
  Line   blockstudio/hero/script.js
 ------ ------------------------------------------------------------
  2      Remove debug output "console.log" from shipped JavaScript.
         🪪  blockstudio.javascript.debugOutput
 ------ ------------------------------------------------------------
```

These checks are reported through PHPStan's result cache. After editing only a
`block.json` or a script, a warm cache can report `[OK] No errors` for the old state. Pass `--debug` after `--`, which
bypasses the cache, before trusting a green run on non-PHP changes:

```bash
vendor/bin/blockstudio-phpstan -- --no-progress --debug
```

## Command options and exit codes

Command-line values replace the matching `blockstudio.json` values for one run.
Replace means replace: passing any `--exclude` drops the configured
`excludePaths`, so repeat `vendor/**` when you add one:

```bash
vendor/bin/blockstudio-phpstan \
  --preset theme \
  --root . \
  --exclude 'vendor/**' \
  --exclude 'fixtures/**' \
  --error-format json \
  -- --no-progress
```

```text
{"totals":{"errors":0,"file_errors":0},"files":{},"errors":[]}
```

Everything after `--` goes to PHPStan. The wrapper raises PHPStan's memory
limit to `1G` unless you pass your own `--memory-limit`, and it composes its
configuration in the system temporary directory, so no generated file lands in
the project. It exits `0` when analysis passes, `1` when PHPStan reports
diagnostics, and `2` for usage, configuration, or execution errors.

Run it through the canonical command rather than adding
`phpstan/extension-installer`. The presets already include the extension, and
with the installer present the same `extension.neon` is loaded twice: PHPStan
stops with "This file is included multiple times" before analysing anything.

## Adopt it on an existing project

A project analysed for the first time usually has findings. Instead of
lowering the preset, record them in a baseline so new code is held to the full
rules:

```bash
vendor/bin/blockstudio-phpstan -- --no-progress --generate-baseline=phpstan-baseline.neon
```

```text
 [OK] Baseline generated with 3 errors.
```

Include the baseline from a project configuration and point
`phpstan.configuration` at it:

```neon title="phpstan.neon"
includes:
    - phpstan-baseline.neon
```

```json title="blockstudio.json"
{
  "phpstan": {
    "preset": "extreme-theme",
    "roots": ["."],
    "excludePaths": ["vendor/**"],
    "configuration": "phpstan.neon"
  }
}
```

The next run reports `[OK] No errors` with the recorded findings in place, and
anything new still fails. With the `base` or `theme` preset, also set
`level: max` under `parameters` in `phpstan.neon`: the canonical command only
sets that level itself when no project configuration is included.

## Gate commits on the analysis

With `"githooks": { "commit": true }` in `blockstudio.json`, synchronize the
managed hook once after installing dependencies:

```bash
vendor/bin/blockstudio-githooks sync
```

```text
Blockstudio commit hook enabled: /path/to/acme/.git/blockstudio/hooks/pre-commit
```

The command writes the hook inside Git's own directory, points
`core.hooksPath` at it, and chains whatever pre-commit hook was configured
before. The hook runs `vendor/bin/blockstudio-phpstan -- --no-progress` from
the project root and nothing else: no formatter, no rewrites. Committing the
broken template from earlier stops at the analysis:

```text
 [ERROR] Found 3 errors

Blockstudio: commit blocked by theme analysis.
```

Set `commit` to `false` and run `sync` again, or run
`vendor/bin/blockstudio-githooks remove`, to restore the previous hook path.
Only files Blockstudio wrote are deleted.

## Generate the project contract

Analysis tells an agent what it got wrong after the fact. An `AGENTS.md` tells
it beforehand: where blocks and pages live, how fields reach templates, which
features are enabled, and what the selected preset will reject.
`blockstudio-agents` generates that document from the project itself:

```bash
vendor/bin/blockstudio-agents
```

```text
Blockstudio contract created: /path/to/acme/AGENTS.md
```

For the theme in this guide, the generated file begins:

```markdown
# Blockstudio contract for Acme

## Project

- Kind: WordPress theme `Acme`.
- Analysed root: `.`.
- Configuration: `blockstudio.json`.
- Analysis preset: `extreme-theme`.
- Excluded from discovery and analysis: `vendor/**`.

## What this project contains

- Blocks: 1 in `blockstudio`.
- Block namespaces: `acme`.
- Block templates are written in PHP.
```

Every line comes from one of three places. The project's files supply the
kind of project, the counts, directories, namespaces, and template languages.
`blockstudio.json` supplies the enabled features, so the commit hook appears
under "Enabled features" and `vendor/bin/blockstudio-githooks sync` under
"Commands" only because `githooks.commit` is set. The selected preset supplies
the correctness section, read from the preset files layer by layer:

```markdown
The `theme` layer adds:

- Every analysed root must exist and carry a `style.css` with a `Theme Name` header.
- Block assets are declared in `block.json`; block code must not call `wp_enqueue_script()` or `wp_enqueue_style()`.
- A block `style.scss` must scope its rules through `%selector%`, and assets referenced by `block.json` must exist.
- Every field must define a `default`, and repeaters must declare non-negative `min` and `max` bounds.
```

### Keep it current

The contract goes stale when the configuration changes. After enabling
Tailwind in `blockstudio.json`, the check mode notices:

```bash
vendor/bin/blockstudio-agents --check
```

```text
Blockstudio contract is out of date: /path/to/acme/AGENTS.md
Run blockstudio-agents to regenerate it.
```

It exits `1`, which makes it usable as a CI step next to the analysis.
Regenerating adds a "Tailwind CSS" feature entry and the
`wp bs tailwind compile` command.

### Notes that survive regeneration

The file ends with a notes region. Anything between its markers is preserved
byte for byte on every regeneration, so project knowledge that cannot be
derived from files belongs there:

```markdown
## Project notes

Everything above is generated. Text between the markers below is preserved when this file is regenerated.

<!-- blockstudio:notes:start -->
Deploys run from the release branch only.
<!-- blockstudio:notes:end -->
```

The generator never replaces a file it did not write. Run against a
hand-written `AGENTS.md`, it refuses and exits `2`:

```text
Blockstudio: Refusing to overwrite the user-owned file at /path/to/acme/AGENTS.md. Pass --force to replace it.
```

To keep hand-written text, copy it aside, run with `--force`, and paste it into
the notes region. The other options are `--root`, `--config`, `--output`, and
`--stdout`, which prints the contract instead of writing it.

## What changes in Blockstudio 7.7

The 7.7 package keeps the commands, presets, and exit codes described here.
Two differences showed up while building this guide against it: `$a` no longer
needs an annotation, as described in the fix section, and the generated
contract describes block tag validation more broadly, covering HTML elements
mapped to blocks in page sources and the global attributes a tag may forward.

## Next steps

- [PHPStan reference](/docs/dev/phpstan): every rule, preset parameter, field
  type shape, live render probe, and diagnostic identifier.
- [AI Integration](/docs/dev/ai): the documentation index for coding agents
  that complements your project contract.
- [Vibecoding with Blockstudio](/guides/vibecoding): working with coding
  agents on a Blockstudio project.
- [Field Patterns Cookbook](/guides/field-patterns): field structures whose
  template keys the analysis understands, including groups and repeaters.
