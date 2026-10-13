---
title: Hosting a Registry
description: How to publish your own block registry for others to use.
path: "hosting"
order: 9
section: "Hosting a Registry"
meta_title: "Hosting a Registry"
meta_description: "How to publish your own block registry for others to use."
---

# Hosting a Registry

A registry is a `registry.json` file and a set of block folders served over
HTTP. There's no special server required. Anything that can serve static files
works.

## What you need

1. A `registry.json` file listing your blocks
2. Block folders with the files referenced in the manifest
3. A web server or hosting service that serves both

## Directory structure

A typical registry repository looks like this:

```
my-registry/
  registry.json
  blocks/
    hero/
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

The `registry.json` points at the `blocks/` directory as its `baseUrl`:

```json
{
  "name": "my-registry",
  "baseUrl": "https://example.com/blocks",
  "blocks": [
    {
      "name": "hero",
      "title": "Hero",
      "files": ["block.json", "index.php", "style.scss"]
    }
  ]
}
```

## Requirements

The hosting must support direct file access via URL. The CLI fetches files by
constructing URLs from `{baseUrl}/{block.name}/{file}`.

The CLI has no login flow of its own. For private registries, handle access
control at the hosting layer (e.g. private GitHub repos with tokens, or a
server that checks credentials) and have consumers send the credentials as
custom headers through the object format in
[`blocks.json`](/registry/configuration/blocks-json#authentication).

## Testing your registry

Before publishing, test locally by starting a simple HTTP server:

```bash
cd my-registry
npx serve .
```

Then point your `blocks.json` at `http://localhost:3000/registry.json` and
run `npx blockstudio list` to verify everything resolves. `list` only fetches
`registry.json`. To test `add`, set `baseUrl` to
`http://localhost:3000/blocks` while testing, because the CLI downloads block
files from `baseUrl`.
