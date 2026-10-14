---
title: list
description: List available blocks from your configured registries.
path: "cli/list"
order: 4
section: "CLI"
meta_title: "list"
meta_description: "List available blocks from your configured registries."
---

# list

```bash
npx blockstudio list [namespace]
```

Fetches all configured registries and displays their available blocks in a
table.

## Arguments

| Argument | Description |
|----------|-------------|
| `namespace` | Optional. Show blocks from a specific registry only. |

## Output

The table shows each block's name, title, category, and type, grouped by
registry.

```
acme (4 blocks)

  Name      Title     Category      Type
  hero      Hero      layout        blockstudio
  card      Card      components    blockstudio
  tabs      Tabs      layout        blockstudio
  tab-item  Tab Item  layout        blockstudio
```

Each configured registry gets its own section. If no registries are
configured, `list` prints `No registries configured.` An unknown namespace
exits with `Registry "<name>" not found. Available: ...`, and a registry
that cannot be fetched stops the output with an error.

## Examples

List all blocks:

```bash
npx blockstudio list
```

List blocks from a specific registry:

```bash
npx blockstudio list ui
```
