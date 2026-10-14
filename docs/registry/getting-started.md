---
title: Getting Started
description: Set up the Blockstudio Registry CLI in your project and install your first block.
path: "getting-started"
order: 1
section: "Introduction"
meta_title: "Getting Started"
meta_description: "Set up the Blockstudio Registry CLI in your project and install your first block."
---

# Getting Started

## Prerequisites

- Node.js 18+
- A WordPress theme or plugin where you want to install blocks

The `blockstudio` package on npm is at version 0.0.1. That release is a
placeholder: it only has an `add` command, which prints `Adding block:
<name>` and exits without fetching anything, and it rejects `init`, `list`,
`search`, `remove`, `--yes` and `--dry-run` as unknown. The commands on these
pages describe the registry CLI in the Blockstudio repository
(`packages/registry`).

## Initialize your project

Run `init` in the root of your theme or plugin:

```bash
npx blockstudio init
```

The CLI walks you through an interactive setup:

1. **Block directory**: where blocks should be installed (default: `blockstudio`)
2. **Registries**: add one or more registry URLs by name

This creates a `blocks.json` file:

```json
{
  "$schema": "https://blockstudio.dev/schema/blocks.json",
  "directory": "blockstudio",
  "registries": {
    "ui": "https://blocks.example.com/registry.json"
  }
}
```

You can also skip the interactive prompts:

```bash
npx blockstudio init --yes
```

This creates a `blocks.json` with defaults. You can edit it manually
afterwards.

## Add a block

```bash
npx blockstudio add ui/tabs
```

The format is `namespace/block`, where `namespace` matches a key in your
`registries` config.

The CLI:

1. Fetches the registry
2. Finds the block
3. Resolves any dependencies (e.g. `tabs` depends on `tab-item`)
4. Downloads all files
5. Writes them to your block directory

If the block exists in only one registry, you can skip the namespace:

```bash
npx blockstudio add tabs
```

If it exists in multiple registries, the CLI prompts you to choose in a
terminal. Without a terminal, it stops with an error that lists the matching
registries, and `--yes` picks the first one in `blocks.json` order.

## Add multiple blocks

```bash
npx blockstudio add ui/tabs ui/hero ui/accordion
```

All blocks are installed in a single run.

## Preview before installing

```bash
npx blockstudio add ui/tabs --dry-run
```

This shows what would be installed without writing any files.

## Browse available blocks

```bash
npx blockstudio list
npx blockstudio list ui
npx blockstudio search hero
```

`list` shows all blocks from all registries (or a specific one). `search`
does a case-insensitive substring match against block names, titles, and
descriptions.

## Remove a block

```bash
npx blockstudio remove tabs
```

This deletes the block folder. In interactive mode, you're prompted to
confirm. Pass `--yes` to skip the prompt.

## CI and automation

`init`, `add`, and `remove` accept `--yes` to skip interactive prompts.
`list` and `search` never prompt and reject `--yes` as an unknown option.
When stdin is not a terminal (CI runners, piped input), the CLI falls back to
non-interactive mode: `init` overwrites an existing `blocks.json`, `add`
stops with an error when a block folder already exists or a block name is
ambiguous, and `remove` deletes without asking.

```bash
npx blockstudio init --yes --directory blockstudio
npx blockstudio add ui/tabs --yes
npx blockstudio remove tabs --yes
```
