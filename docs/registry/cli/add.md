---
title: add
description: Add blocks from a registry to your project.
path: "cli/add"
order: 3
section: "CLI"
meta_title: "add"
meta_description: "Add blocks from a registry to your project."
---

# add

```bash
npx blockstudio add <blocks...> [options]
```

Downloads blocks from a registry and writes them to your project's block
directory.

## Arguments

| Argument | Description |
|----------|-------------|
| `blocks` | One or more blocks to add. Format: `namespace/block` or just `block`. |

## Options

| Option | Description |
|--------|-------------|
| `-y, --yes` | Skip all prompts (overwrite, conflict resolution). |
| `--dry-run` | Preview what would be installed without writing files. |

## Namespace resolution

When you specify a namespace, the CLI looks in that specific registry:

```bash
npx blockstudio add ui/tabs
```

When you omit the namespace, the CLI searches all configured registries:

```bash
npx blockstudio add tabs
```

If the block is found in exactly one registry, it's used automatically. If
found in multiple, the CLI shows an interactive select prompt to choose.

With `--yes`, the first matching registry in `blocks.json` order is used.
Without a terminal, and with `--dry-run`, an ambiguous name stops the command
with an error that lists the registries:

```
Block "hero" found in multiple registries: acme, starter. Specify one: blockstudio add acme/hero
```

Before resolving any block, `add` fetches every configured registry. If one
of them is unreachable or invalid, the command fails, even for a block with
an explicit namespace.

## Dependencies

Blocks can declare dependencies on other blocks in the same registry. When
you add a block, its dependencies are resolved and installed automatically.

```bash
npx blockstudio add ui/tabs
```

If `tabs` depends on `tab-item`, both blocks are downloaded and installed.
Dependencies are always installed before the blocks that depend on them.

Circular dependencies are detected and rejected with an error.

## Overwrite behavior

If a block folder already exists in the target directory:

- **Interactive mode**: prompts you to confirm the overwrite
- **`--yes` flag**: overwrites without asking
- **`--dry-run` flag**: reports what would be overwritten
- **Non-interactive mode without `--yes`**: stops before downloading, with
  `Block "<name>" already exists at <path>. Use --yes to overwrite.`

The check covers dependencies too, so adding `tabs` when `tab-item` is
already installed needs `--yes`.

## Multiple blocks

Blocks passed in one command are processed in order. If one of them fails,
the command stops there, and blocks installed earlier in the same run stay
on disk.

## Examples

Add a single block:

```bash
npx blockstudio add ui/hero
```

Add multiple blocks:

```bash
npx blockstudio add ui/tabs ui/hero ui/accordion
```

Preview without writing:

```bash
npx blockstudio add ui/tabs --dry-run
```

Skip all prompts:

```bash
npx blockstudio add ui/tabs --yes
```
