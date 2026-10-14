---
title: Deploying a Blockstudio Site
description: Ship a Blockstudio theme from CI. Install Composer dependencies, reconcile file-backed pages with a JSON report, refresh the static cache, and know which maintenance commands belong in a release.
path: "deploying"
order: 18
section: "Guides"
meta_title: "Deploying a Blockstudio Site"
meta_description: "Ship a Blockstudio theme from CI. Install Composer dependencies, reconcile file-backed pages with a JSON report, refresh the static cache, and know which maintenance commands belong in a release."
---

# Deploying a Blockstudio Site

Copying a theme folder to a server is enough for blocks: Blockstudio discovers
them from the filesystem, and its caches notice changed inputs on their own.
A real site has more moving parts. File-backed pages only reach the database
when you synchronize them. A static prerender keeps serving yesterday's HTML
until something replaces it. A CDN in front keeps serving whatever it cached.

This guide builds a deploy for a theme called `acme` that bundles Blockstudio
through Composer. It covers what runs in CI, what runs on the server after the
files land, how to read the page synchronization report, and which `wp bs`
commands belong in a release.

## The release in one picture

1. **Build.** CI installs production Composer dependencies.
2. **Upload.** The theme, including `vendor/`, reaches the server.
3. **Reconcile pages.** `wp bs pages sync` brings page posts in line with the
   files and prints a report.
4. **Refresh the origin cache.** Stored HTML is purged when pages changed,
   then re-warmed.
5. **Purge the CDN.** Last, so the edge refills from a fresh origin.

Steps 3 and 4 need WP-CLI on the server. The script below also uses `jq` to
read JSON.

## Step 1: Composer in CI

Bundle Blockstudio in the theme and commit `composer.lock`, so CI installs the
exact version you tested:

```json title="composer.json"
{
  "require": {
    "blockstudio/blockstudio": "^7.0"
  }
}
```

```php title="functions.php"
<?php
require_once __DIR__ . '/vendor/autoload.php';
```

In CI, install without development packages:

```bash
composer install --no-dev --optimize-autoloader --no-interaction --prefer-dist
```

Blockstudio bootstraps from the autoloader, and its own runtime dependencies
are bundled and namespaced inside the package. When it loads from a `vendor/`
directory, its built-in GitHub updater is disabled, so Composer stays the only
way the version changes.

## Step 2: Decide what must be writable

Blockstudio writes generated files at runtime. Know where, before a deploy
replaces or locks a directory:

- **Runtime caches** live under `wp-content/blockstudio/cache/` by default.
  Point `cache.path` at a dedicated writable volume if you prefer. Changing the
  path starts cold.
- **Compiled block assets** are written to a `_dist` folder beside each block
  by default. If your release directory is read-only or replaced on every
  deploy, set `assets.output` to `cache` so they go under the cache directory
  instead:

```json title="blockstudio.json"
{
  "$schema": "https://blockstudio.dev/schema/blockstudio",
  "assets": {
    "output": "cache"
  }
}
```

You do not need to clear caches on deploy. Every cache entry is keyed by its
inputs, including block files, settings, the active theme and plugins, and the
WordPress, PHP, and Blockstudio versions, so a release that changes them gets
new keys. In `production` and `staging`, Blockstudio trusts a validated watch
snapshot for 20 seconds before it checks files again, so a change can take up
to 20 seconds to be noticed. The `blockstudio/cache/watch_debounce` filter
changes that window.

## Step 3: Reconcile pages

Page posts change only through an explicit synchronization. Frontend, admin,
Ajax, REST, cron, and ordinary WP-CLI requests never discover page sources or
write page posts. The deploy has to ask:

```bash
wp bs pages sync --format=json
```

On a site whose theme has two pages, `about` and `contact`, the first run
creates them:

```json
{
    "discovered": 2,
    "created": 2,
    "updated": 0,
    "unchanged": 0,
    "removed": 0,
    "failed": 0,
    "fullReconciliation": true,
    "sourceId": "f88baddfd5a1deb94eb8c9bbeca10d5a0d47a72f16b50efdb25a7127945af7dd",
    "sourceIdentity": {
        "commit": "",
        "dirtyHash": "",
        "inventoryHash": "aaec5b9dd13d74eea872117b6167caa7a5d5c1abad9572fba22f6ddf6340adfe",
        "engineFingerprint": "2c442442bb49f91e7187560e6db8f3475caa0b62b47708cab95b6ff13aba4469",
        "hash": "f88baddfd5a1deb94eb8c9bbeca10d5a0d47a72f16b50efdb25a7127945af7dd"
    },
    "pages": {
        "about": {
            "status": "created",
            "postId": 545,
            "locked": false
        },
        "contact": {
            "status": "created",
            "postId": 546,
            "locked": false
        }
    },
    "errors": []
}
```

How to read it:

- `created`, `updated`, `unchanged`, `removed`, and `failed` count pages. A
  page whose source fingerprint did not change produces no post or post meta
  writes and fires no update hooks.
- Every pass compares the complete page inventory. `fullReconciliation`
  reports whether the pass counts as a full reconciliation: `true` on the
  first run, with `--full`, or when the sync engine itself changed, and
  `false` when an identity from a previous successful sync exists. Downstream
  tooling can use it to decide whether to rebuild everything.
- `sourceIdentity` is a deterministic fingerprint of the page inventory and
  the sync engine. The command stores it after a successful pass.

Without `--format=json`, the command prints one summary row and a success
line. In a CI log, which is not a terminal, the row is tab-separated:

```text
discovered	created	updated	unchanged	removed	failed	source_id
2	0	1	1	0	0	7bd575b4ee6c0a948f439dd83ce5fa403f8113c9406c3b13b6ade2f2b19f3c2c
Success: File-backed pages synchronized.
```

That run followed an edit to `about/index.php`: one page updated, one
unchanged.

### When synchronization fails

The command exits with status 1 when discovery or reconciliation reports an
error, which fails the CI step. The JSON report is still printed, so log it.
A malformed `page.json` looks like this:

```json
{
    "discovered": 0,
    ...
    "failed": 1,
    ...
    "pages": [],
    "errors": [
        {
            "code": "invalid_page_json",
            "message": "Invalid page.json file.",
            "context": {
                "path": ".../wp-content/themes/acme/pages/pricing/page.json"
            }
        }
    ]
}
```

Managed pages whose sources disappeared are pruned only after a pass finishes
without errors, so a release that fails to sync does not trash live pages. Removed pages
go to the trash by default; the `blockstudio/pages/orphan_action` filter can
return `trash`, `delete`, or `keep`.

### Run it on every deploy

Run the sync even when no page changed. If you deploy into release
directories and switch a symlink, an unchanged page still points at the
previous release's template and layout paths until the next sync refreshes
them. That refresh does not touch `post_content` or the modified date.

### `--authoritative` and `--full`

A normal sync preserves content that editors changed inside keyed blocks.
`--authoritative` replaces managed content from the files instead, and may
clear a Page Sync lock. Use it when the files are meant to win: resetting a
staging site, or a site where nobody edits file-backed pages in the editor.
Do not put it in every deploy of a site with active editors.

`--full` marks the pass as a full reconciliation regardless of the stored
identity. Page comparison is already complete on every pass, so the flag
changes `fullReconciliation` in the report, not which pages are checked. Pass
it when a later step keys a full rebuild off that value.

Tooling written in PHP can call `Blockstudio\Pages::reconcile()` directly.
It returns the same report, but it does not store the identity: call
`Blockstudio\Pages::store_successful_source_identity()` once the rest of the
release, such as an activated static artifact, has been verified.

## Step 4: Refresh the static cache

If the site uses [static prerendering](/guides/static-prerendering) in the
default `signature` mode, page posts updated from WP-CLI do not purge stored
HTML on their own. Read the report and purge when anything changed, then
warm:

```bash title="scripts/post-deploy.sh"
#!/usr/bin/env bash
set -euo pipefail

cd /var/www/example.com
report=$(mktemp)

# 1. Reconcile file-backed pages and keep the report.
if ! wp bs pages sync --format=json > "$report"; then
  cat "$report"
  exit 1
fi
jq '{discovered, created, updated, unchanged, removed}' "$report"

# 2. Drop stored HTML when page content changed.
changed=$(jq '.created + .updated + .removed' "$report")
if [ "$changed" -gt 0 ]; then
  wp bs prerender purge
fi

# 3. Re-warm in bounded passes until a pass warms nothing.
for _ in $(seq 1 50); do
  warmed=$(wp bs prerender warm | jq '.warmed')
  [ "$warmed" -gt 0 ] || break
done

wp bs prerender status | jq '{files, queue}'
```

Each `wp bs prerender warm` run enqueues stale public URLs, renders up to
`warm.concurrency` of them, and prints a summary. In this pass, four of six
queued URLs were claimed and all four failed to render:

```json
{"queued":6,"processed":4,"warmed":0,"skipped":0,"failed":4}
```

A URL that fails to render stays stale and is enqueued again on the next run,
which is why the loop stops on the first pass that warms nothing instead of
waiting for an empty queue. Anything left over is picked up by the scheduled
warmer or by the next anonymous visit.

In `graph` mode the per-URL warmer is off and `warm` enqueues nothing. Graph
sites replace steps 2 and 3 with their own build, which renders the affected
URLs and activates the result atomically. See
[signature and graph modes](/docs/production/static-prerendering#signature-and-graph-modes).

## Step 5: The CI workflow

The workflow below is a GitHub Actions example. The shape carries over to
any CI system: build, upload, run the script on the server, purge the CDN.

```yaml title=".github/workflows/deploy.yml"
name: Deploy

on:
  push:
    branches: [main]

concurrency:
  group: deploy-production
  cancel-in-progress: false

jobs:
  deploy:
    runs-on: ubuntu-latest
    environment: production
    steps:
      - uses: actions/checkout@v4

      - uses: shivammathur/setup-php@v2
        with:
          php-version: "8.2"
          tools: composer:v2

      - name: Install production dependencies
        run: composer install --no-dev --optimize-autoloader --no-interaction --prefer-dist

      - name: Configure SSH
        run: |
          mkdir -p ~/.ssh
          echo "${{ secrets.DEPLOY_KEY }}" > ~/.ssh/id_ed25519
          chmod 600 ~/.ssh/id_ed25519
          ssh-keyscan example.com >> ~/.ssh/known_hosts

      - name: Upload the theme
        run: |
          rsync -az --delete --exclude ".git" --exclude ".github" \
            ./ deploy@example.com:/var/www/example.com/wp-content/themes/acme/

      - name: Sync pages and refresh the static cache
        run: ssh deploy@example.com 'bash -s' < scripts/post-deploy.sh

      - name: Purge the CDN
        run: curl -fsS -X POST "${{ secrets.CDN_PURGE_URL }}"
```

`concurrency` with `cancel-in-progress: false` queues a second push behind a
running deploy instead of cancelling it halfway through a sync. PHP 8.2 is
Blockstudio's minimum. Replace the last step with your CDN's purge API.

## Maintenance commands

These do not belong in every release, but a deploy runbook should know them.

**Draining the legacy lock backlog.** Releases before 7.6.14 left a
`.build.lock` file behind for every content change. After upgrading, WP-Cron
removes them in bounded batches. To check, and to drain the backlog at once:

```bash
wp bs cache status
wp bs cache cleanup
```

```text
0 legacy build lock(s) across 0 cache namespace(s).
Next cleanup batch in 0 second(s).
```

`cleanup` leaves locks newer than an hour or still held by a running request
for the next pass. Never delete lock files by hand while the site serves
traffic.

**Clearing the runtime cache.** `wp bs cache clear` purges everything for the
current site, and `wp bs cache clear --scope=runtime` purges one scope across
every namespace. The next request rebuilds cold, so run it at low traffic, and
only when you have a reason: input changes already rotate the keys.

**Removing Blockstudio.** A Composer install has no plugin deactivation hook,
so nothing unschedules cron events or removes the early-serve drop-in when
the package disappears. Run this before removing the dependency:

```bash
wp bs teardown
```

It removes the cron events and the static prerender state this installation
owns, leaves foreign drop-ins and configuration files alone, and lets a later
re-enable start cleanly.

## Next steps

- [Building File-Based Pages](/guides/file-based-pages): the pages this deploy reconciles.
- [Pages reference](/docs/pages-and-patterns/pages#sync-behavior): sync behavior, the PHP reconciliation API, and the deployment identity contract.
- [CLI reference](/docs/dev/cli): every `wp bs` command.
- [Caching](/docs/production/caching): cache location, identity, retention, and the lock backlog.
- [Serving WordPress as Static HTML](/guides/static-prerendering): the cache that step 4 refreshes.
- [Composer](/docs/dev/composer): plugin, must-use, theme, and plugin-bundled installs.
