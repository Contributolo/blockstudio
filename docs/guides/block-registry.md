---
title: Publishing a Block Registry on GitHub
description: Share blocks across projects from a GitHub repository. Structure the repo, write registry.json, serve it through raw URLs, and install blocks with the registry CLI.
path: "block-registry"
order: 19
section: "Guides"
meta_title: "Publishing a Block Registry on GitHub"
meta_description: "Share blocks across projects from a GitHub repository. Structure the repo, write registry.json, serve it through raw URLs, and install blocks with the registry CLI."
---

# Publishing a Block Registry on GitHub

Once you have built a few good blocks, you want them in the next project too.
Copying folders between themes by hand works until the copies drift apart and
nobody remembers which theme has the fixed version. Wrapping every block in a
package with its own build is a lot of ceremony for a folder that holds a
`block.json` and a template.

A block registry sits in between. It is a `registry.json` file and a set of
block folders, served over plain HTTP. Consumers run a CLI command, the block
source is copied into their theme, and from then on they own that copy. A
GitHub repository is enough to host one, because GitHub serves every file in a
public repository at a raw URL.

This guide builds a registry called `acme` with four blocks, publishes it from
the repository `acme/acme-blocks`, installs blocks from it into a theme, and
pins a release through a git tag.

The `blockstudio` package on npm is at version 0.0.1. That release is a
placeholder: its only command, `add`, prints `Adding block: <name>` and exits
without fetching anything. The commands and output in this guide come from the
registry CLI in the Blockstudio repository (`packages/registry`), which is the
CLI the [Registry docs](/registry) describe.

## How the pieces fit

There are two files to know:

- `registry.json` is published by the block author. It lists the blocks, the
  files each block consists of, and a `baseUrl` to download them from.
- `blocks.json` lives in the consumer's theme or plugin. It names the registries
  to use and the directory blocks are installed into.

When you install a block, the CLI fetches every registry in `blocks.json`,
finds the block, resolves its dependencies, downloads each listed file from
`{baseUrl}/{block}/{file}`, and writes it to `{directory}/{block}/{file}`. It
does not transform anything, so the files on disk are exactly the files in the
repository.

## Step 1: Structure the repository

Create a repository with a `registry.json` at the root and one folder per block
under `blocks/`:

```
acme-blocks/
  registry.json
  blocks/
    hero/
      block.json
      index.php
    card/
      block.json
      index.php
      style.scss
    tabs/
      block.json
      index.php
      style.scss
    tab-item/
      block.json
      index.php
```

The folder name is the block's name in the registry and becomes the folder name
in the consumer's theme. Keep it identical to the second half of the block name
in `block.json` (`acme/hero` lives in `hero/`), so the installed folder is easy
to recognise.

## Step 2: Write the blocks

Each folder is an ordinary Blockstudio block. The hero block has one field:

```json title="blocks/hero/block.json"
{
  "$schema": "https://blockstudio.dev/schema/block",
  "apiVersion": 3,
  "name": "acme/hero",
  "title": "Hero",
  "category": "design",
  "blockstudio": {
    "attributes": [
      {
        "id": "heading",
        "type": "text",
        "label": "Heading",
        "default": "Build faster"
      }
    ]
  }
}
```

```php title="blocks/hero/index.php"
<section useBlockProps class="acme-hero">
  <h1><?php echo esc_html( $a['heading'] ); ?></h1>
</section>
```

`card` follows the same pattern and adds a `style.scss`. `tabs` renders
`<InnerBlocks allowedBlocks='["acme/tab-item"]' />`, and `tab-item` declares
`"parent": ["acme/tabs"]`, so `tabs` is not useful without `tab-item`. The
registry expresses that relationship in the next step.

Nothing about these blocks is registry specific. The CLI copies folders, so a
block built with `@wordpress/create-block` or registered with plain PHP can be
published the same way.

## Step 3: Write registry.json

`registry.json` lists every block and every file the CLI should download:

```json title="registry.json"
{
  "$schema": "https://blockstudio.dev/schema/registry.json",
  "name": "acme",
  "description": "Acme block library.",
  "baseUrl": "https://raw.githubusercontent.com/acme/acme-blocks/main/blocks",
  "blocks": [
    {
      "name": "hero",
      "title": "Hero",
      "description": "Full-width hero section with a heading.",
      "category": "layout",
      "type": "blockstudio",
      "files": ["block.json", "index.php"]
    },
    {
      "name": "card",
      "title": "Card",
      "description": "Content card with a title.",
      "category": "components",
      "type": "blockstudio",
      "files": ["block.json", "index.php", "style.scss"]
    },
    {
      "name": "tabs",
      "title": "Tabs",
      "description": "Tabbed content with keyboard navigation.",
      "category": "layout",
      "type": "blockstudio",
      "dependencies": ["tab-item"],
      "files": ["block.json", "index.php", "style.scss"]
    },
    {
      "name": "tab-item",
      "title": "Tab Item",
      "description": "Single tab panel used inside Tabs.",
      "category": "layout",
      "type": "blockstudio",
      "files": ["block.json", "index.php"]
    }
  ]
}
```

A few rules decide whether this file works:

- **`files` is an explicit list.** The CLI downloads exactly these paths and
  nothing else. There is no globbing, so a new asset only ships once you add it
  here. Paths may contain subdirectories, which are created on install.
- **`baseUrl` must be an absolute URL.** The CLI validates it as a URL and
  rejects relative values. Block files are always fetched from `baseUrl`, never
  from a location relative to wherever `registry.json` was loaded.
- **`dependencies` name blocks in the same registry.** Adding `tabs` installs
  `tab-item` first. Missing and circular dependencies stop the install with an
  error.
- **`name` is required but not displayed.** Commands and output use the key the
  consumer gives the registry in `blocks.json`, which does not have to match.
- **`type` is informational.** It accepts `blockstudio`, `create-block`, or
  `wordpress`, and does not change what the CLI does.

The CLI validates the whole file on every fetch and reports each failing field,
so a typo shows up before any file is downloaded. The `$schema` line gives you
the same checks in your editor.

## Step 4: Publish through raw URLs

Commit and push the repository to GitHub. Every file in a public repository is
then available at:

```
https://raw.githubusercontent.com/<owner>/<repo>/<ref>/<path>
```

`<ref>` is a branch, a tag, or a commit SHA. For this registry that gives two
URLs that matter:

- The registry URL consumers configure:
  `https://raw.githubusercontent.com/acme/acme-blocks/main/registry.json`
- The `baseUrl` in `registry.json`:
  `https://raw.githubusercontent.com/acme/acme-blocks/main/blocks`

With that `baseUrl`, the `index.php` of `hero` is fetched from
`https://raw.githubusercontent.com/acme/acme-blocks/main/blocks/hero/index.php`.
The raw host returns file content instead of the GitHub HTML page, which is
what the CLI needs. A wrong owner, repository, or ref surfaces as a 404 on the
first command:

```
Registry returned 404 for https://raw.githubusercontent.com/acme/acme-blocks/main/registry.json
```

## Step 5: Install blocks in a theme

In the root of the consuming theme, create `blocks.json`:

```bash
npx blockstudio init --yes
```

```
Created .../acme-theme/blocks.json
```

`init --yes` writes an empty `registries` object. Add the registry under the
namespace you want to type in commands:

```json title="blocks.json"
{
  "$schema": "https://blockstudio.dev/schema/blocks.json",
  "directory": "blockstudio",
  "registries": {
    "acme": "https://raw.githubusercontent.com/acme/acme-blocks/main/registry.json"
  }
}
```

Run `init` without `--yes` in a terminal to answer the same questions
interactively (block directory, registry names and URLs) instead.

Check that the registry resolves:

```bash
npx blockstudio list
```

```
acme (4 blocks)

  Name      Title     Category      Type
  hero      Hero      layout        blockstudio
  card      Card      components    blockstudio
  tabs      Tabs      layout        blockstudio
  tab-item  Tab Item  layout        blockstudio
```

`search` matches a case-insensitive substring against names, titles, and
descriptions:

```bash
npx blockstudio search tab
```

```
Results for "tab"

  acme/tabs - Tabs
    Tabbed content with keyboard navigation.
  acme/tab-item - Tab Item
    Single tab panel used inside Tabs.
```

Preview an install with `--dry-run`. The dependency is listed first, because it
is installed first:

```bash
npx blockstudio add acme/tabs --dry-run
```

```
Would install:
  tab-item (2 files)
  tabs (3 files)
```

Then install for real:

```bash
npx blockstudio add acme/tabs
```

```
Downloading acme/tabs...
Installed tab-item (2 files)
Installed tabs (3 files)
```

Both folders now sit in the theme's `blockstudio` directory, exactly as they
are in the repository:

```
blockstudio/tab-item/block.json
blockstudio/tab-item/index.php
blockstudio/tabs/block.json
blockstudio/tabs/index.php
blockstudio/tabs/style.scss
```

You can drop the namespace when only one configured registry has the block,
and pass several blocks at once:

```bash
npx blockstudio add hero card
```

```
Downloading acme/hero...
Installed hero (2 files)
Downloading acme/card...
Installed card (3 files)
```

Blockstudio discovers the new folders like any other block in the theme.

## Updating installed blocks

The installed files are a copy. Nothing tracks which version you installed, and
the CLI never updates a block on its own. To pull a newer version, add the
block again. Without a terminal, or in CI, an existing folder stops the
command:

```bash
npx blockstudio add tab-item
```

```
Block "tab-item" already exists at .../acme-theme/blockstudio/tab-item. Use --yes to overwrite.
```

In a terminal, the CLI asks before overwriting instead. `--dry-run` reports the
folders it would replace, and `--yes` replaces them:

```bash
npx blockstudio add acme/tab-item --dry-run
```

```
Would overwrite tab-item
Would install:
  tab-item (2 files)
```

Overwriting replaces the listed files with the registry's version, so commit
local changes first and review the result with `git diff`.

To uninstall, remove the folder by name:

```bash
npx blockstudio remove tabs --yes
```

```
Removed tabs
```

`remove` takes the folder name, not `namespace/block`. It does not remove
dependencies, so `tab-item` stays installed after removing `tabs`.

## Versioning with git refs

The CLI has no version field and no version flag. What it fetches is decided
entirely by the URLs, and on GitHub the ref in the URL is the version. A
consumer who points at `main` gets whatever `main` holds at install time.

To publish a release that stays fixed, the `registry.json` at the tag must also
download from the tag. Before tagging, set `baseUrl` to the tag:

```json
"baseUrl": "https://raw.githubusercontent.com/acme/acme-blocks/v1.0.0/blocks"
```

Then commit, tag, and push:

```bash
git commit -am 'Release v1.0.0'
git tag v1.0.0
git push origin main v1.0.0
```

Afterwards, set `baseUrl` back to `main` and commit, so the branch keeps
serving current files. If you skip the first step, a consumer pinned to the tag
gets the tagged block list but downloads the files from `main`.

Consumers pin by using the tag in their registry URL:

```json title="blocks.json"
{
  "$schema": "https://blockstudio.dev/schema/blocks.json",
  "directory": "blockstudio",
  "registries": {
    "acme": "https://raw.githubusercontent.com/acme/acme-blocks/v1.0.0/registry.json"
  }
}
```

In this example `v1.0.0` was tagged before `tabs` and `tab-item` existed, so
the pinned registry only offers the two original blocks:

```bash
npx blockstudio list
```

```
acme (2 blocks)

  Name  Title  Category      Type
  hero  Hero   layout        blockstudio
  card  Card   components    blockstudio
```

```bash
npx blockstudio add acme/tabs
```

```
Block "tabs" not found in registry "acme".
```

A commit SHA works in the registry URL too, but a commit cannot contain its own
SHA in `baseUrl`. Pinning by SHA therefore fixes the block list while the files
still come from whatever ref that commit's `baseUrl` names, so prefer tags for
releases.

## Things to keep in mind

- **Every registry is fetched first.** `add` loads all registries in
  `blocks.json` before it resolves anything, so one unreachable registry makes
  the command fail even for `acme/hero`. Remove registries you no longer use.
- **Ambiguous names need a namespace.** If two registries both have `hero`, a
  terminal session asks which one to use, `--yes` takes the first in
  `blocks.json` order, and a non-interactive run exits with
  `Block "hero" found in multiple registries: acme, starter. Specify one: blockstudio add acme/hero`.
- **Private repositories need headers.** Use the object form of a registry
  entry with `url` and `headers`. Header values support `${VAR}` placeholders
  that are read from the environment, and the CLI sends the headers with the
  registry fetch and with every file download. See
  [GitHub hosting](/registry/hosting/github#private-repositories) for the
  token setup.

## Next steps

- [Registry overview](/registry): what the registry is and how the CLI works
- [registry.json](/registry/configuration/registry-json): every field of the manifest
- [blocks.json](/registry/configuration/blocks-json): consumer config, authentication, and config discovery
- [add](/registry/cli/add): namespace resolution, dependencies, and overwrite behaviour
- [GitHub hosting](/registry/hosting/github): GitHub Pages and private repositories
- [Custom server](/registry/hosting/custom-server): serving a registry from your own infrastructure
