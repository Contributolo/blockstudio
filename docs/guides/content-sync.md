---
title: Moving Database Content into Files with Content Sync
description: Pull selected posts, terms, and metadata into portable files, review them in git, and push them to another environment with stable IDs, declared references, and safe pruning.
path: "content-sync"
order: 14
section: "Guides"
meta_title: "Moving Database Content into Files with Content Sync"
meta_description: "Pull selected posts, terms, and metadata into portable files, review them in git, and push them to another environment with stable IDs, declared references, and safe pruning."
---

# Moving Database Content into Files with Content Sync

Blocks, templates, and file-based pages already live in your repository. Some
content does not fit that model, because editors create it in the admin: team
members, office locations, case studies. That content still matters to the
project. A staging site needs the same team page as production, a new developer
needs realistic data, and a reviewer should see when someone changes a job
title. Database dumps solve none of this well. They carry everything, IDs differ
per environment, and nobody reviews a SQL diff.

Content Sync covers that gap. A WP-CLI command projects an allowlist of posts,
terms, relationships, and metadata into JSON and HTML files in your theme.
Another command applies those files to a different database. Every entity gets
a portable UID, and references between entities are rewritten only where you
declare them.

This guide walks through a team directory: pulling it into files, reviewing it,
editing a file, moving it to a fresh environment, and pruning safely.

## The Example

The theme registers an `acme_member` post type and an `acme_team` taxonomy in
every environment. Each member post can carry:

| Meta key | Holds |
| --- | --- |
| `_acme_role` | The job title, a plain string |
| `_acme_mentor` | The post ID of another member |
| `_thumbnail_id` | The attachment ID of the portrait |
| `_acme_api_token` | An integration token that must never reach git |

Content Sync never registers post types or taxonomies. They must exist wherever
you push.

## Step 1: Configure Content Sync

Content Sync is off until you enable it in `blockstudio.json`. Until then every
command returns a single `skipped` row:

```bash
wp bs content status
```

```
action   entity   id       uid  message
skipped  content  default       Content Sync is disabled. Set content.enabled to true to run this command.
```

Add a `content` group:

```json title="blockstudio.json"
{
  "$schema": "https://blockstudio.dev/schema/blockstudio",
  "content": {
    "enabled": true,
    "id": "team",
    "path": "content",
    "postTypes": ["acme_member"],
    "taxonomies": ["acme_team"],
    "meta": {
      "include": ["_acme_*", "_thumbnail_id"],
      "references": {
        "_acme_mentor": { "kind": "post" },
        "_thumbnail_id": { "kind": "attachment" }
      }
    },
    "media": "manifest"
  }
}
```

Each key draws a boundary:

- `postTypes` and `taxonomies` are allowlists. Nothing outside them is read,
  written, or pruned. An empty `postTypes` means no posts are touched.
- `meta.include` allowlists meta keys, with `*` wildcards. `meta.exclude` always
  wins over it, and `_edit_lock`, `_edit_last`, and `_wp_old_slug` are excluded
  by default.
- `meta.references` declares which meta values are IDs. Content Sync never
  guesses that an integer is an ID.
- `id` names the content set. It is stored on every synced entity, and pruning
  only ever touches entities of the same set.
- `path` is the output folder, relative to the active theme directory.

## Step 2: Pull

Preview the projection first. Nothing is written, and the UIDs shown are not
stored yet:

```bash
wp bs content pull --dry-run
```

```
action       entity  id   uid          message
would-write  post    530  4c8e9997-...  .../posts/acme_member/jane.4c8e9997.json
would-write  post    531  6cddc303-...  .../posts/acme_member/sam.6cddc303.json
would-write  term    4    6661b6d9-...  .../terms/acme_team/leadership.6661b6d9.json
```

Then pull for real. This assigns a permanent `_blockstudio_content_uid` to each
entity that does not have one and writes the files:

```bash
wp bs content pull
```

```
action   entity  id        uid          message
written  post    530       5d4bf9b5-...  .../posts/acme_member/jane.5d4bf9b5.json
written  post    531       208db72e-...  .../posts/acme_member/sam.208db72e.json
written  term    4         7491a6a1-...  .../terms/acme_team/leadership.7491a6a1.json
written  media   manifest                .../media/manifest.json
```

The result in the theme:

```
content/
├── media/
│   └── manifest.json
├── posts/
│   └── acme_member/
│       ├── jane.5d4bf9b5.html
│       ├── jane.5d4bf9b5.json
│       └── sam.208db72e.json
└── terms/
    └── acme_team/
        └── leadership.7491a6a1.json
```

File names combine the slug with the first part of the UID. The post JSON
holds the fields, term relationships, and the allowed meta:

```json title="content/posts/acme_member/jane.5d4bf9b5.json"
{
    "uid": "5d4bf9b5-16b7-4975-acc6-51dc1d4e49ec",
    "type": "acme_member",
    "status": "publish",
    "slug": "jane",
    "title": "Jane Doe",
    "date": "2026-10-13T03:03:02+00:00",
    "modified": "2026-10-13T03:03:02+00:00",
    "parent": null,
    "menuOrder": 0,
    "terms": {
        "acme_team": [
            "7491a6a1-702c-4a29-9993-9ae7b2a79c0a"
        ]
    },
    "meta": {
        "_acme_role": "Design Lead",
        "_thumbnail_id": "72a2db75-6fd2-41f9-8d3c-b323ce3b3551"
    },
    "metaEncoding": {
        "_acme_role": "scalar",
        "_thumbnail_id": "scalar"
    }
}
```

The term relationship and the thumbnail are UIDs, not local IDs. The post body
lives next to it in `jane.5d4bf9b5.html` as raw block markup. A post with empty
content, like Sam's, gets no `.html` file. Sam's `_acme_mentor` is stored as
Jane's UID, because the key is declared as a `post` reference.

## Step 3: Review Before You Commit

Run `status` before committing. It compares files and database and also flags
risky data:

```bash
wp bs content status
```

```
action     entity  id               uid          message
unchanged  post    530              5d4bf9b5-...  .../posts/acme_member/jane.5d4bf9b5.json
unchanged  post    531              208db72e-...  .../posts/acme_member/sam.208db72e.json
unchanged  term    4                7491a6a1-...  .../terms/acme_team/leadership.7491a6a1.json
warning    meta    _acme_api_token                Allowlisted meta key may contain secrets or PII; review before committing synced files.
```

The `_acme_*` wildcard caught the token. Treat `meta.include` as a commit
boundary and exclude the key explicitly:

```json title="blockstudio.json"
"meta": {
  "include": ["_acme_*", "_thumbnail_id"],
  "exclude": ["_acme_api_token"],
  "references": {
    "_acme_mentor": { "kind": "post" },
    "_thumbnail_id": { "kind": "attachment" }
  }
}
```

The next `pull` rewrites `sam.208db72e.json` without the token and leaves the
other files untouched. `status` also warns about numeric IDs inside block
markup bodies, because Content Sync does not rewrite IDs in `.html` files.

Commit the `content/` folder.

## Step 4: Edit a File and Push

Files are the source of truth for `push`. Change Jane's role in the JSON file
from `Design Lead` to `Head of Design`, then check what would happen:

```bash
wp bs content status
```

```
action        entity  id   uid          message
would-update  post    530  5d4bf9b5-...  .../posts/acme_member/jane.5d4bf9b5.json
unchanged     post    531  208db72e-...  .../posts/acme_member/sam.208db72e.json
unchanged     term    4    7491a6a1-...  .../terms/acme_team/leadership.7491a6a1.json
```

`push --dry-run` prints the same plan in push order. Apply it:

```bash
wp bs content push
```

```
action     entity  id   uid          message
unchanged  term    4    7491a6a1-...  .../terms/acme_team/leadership.7491a6a1.json
updated    post    530  5d4bf9b5-...  .../posts/acme_member/jane.5d4bf9b5.json
unchanged  post    531  208db72e-...  .../posts/acme_member/sam.208db72e.json
```

Push validates the complete plan before it writes. Unresolved declared
references, slug conflicts, missing post types, and malformed files stop it.

WordPress gives an updated post a new modified time, while the file still has
the old `modified` value. A `status` run right after this push therefore reports
Jane's post as `conflict` with "Database changed since last sync." Run `pull`
once after pushing to capture the new time; `status` then reports `unchanged`.

## Step 5: Move the Content to Another Environment

On a fresh environment the files describe posts that do not exist yet. In this
example the term and the portrait attachment already exist there with the same
UIDs, so only the two members are missing:

```bash
wp bs content status
```

```
action      entity  id    uid          message
missing-db  post    jane  5d4bf9b5-...  .../posts/acme_member/jane.5d4bf9b5.json
missing-db  post    sam   208db72e-...  .../posts/acme_member/sam.208db72e.json
unchanged   term    4     7491a6a1-...  .../terms/acme_team/leadership.7491a6a1.json
```

```bash
wp bs content push
```

```
action     entity  id   uid          message
unchanged  term    4    7491a6a1-...  .../terms/acme_team/leadership.7491a6a1.json
created    post    536  5d4bf9b5-...  .../posts/acme_member/jane.5d4bf9b5.json
created    post    537  208db72e-...  .../posts/acme_member/sam.208db72e.json
```

The posts received new local IDs, 536 and 537. The references followed: Sam's
`_acme_mentor` now holds 536, Jane is in the `leadership` term again, and her
`_thumbnail_id` points at the local attachment with the matching UID. Post
parents, term parents, and term relationships are always stored as UIDs; meta
values are rewritten only for keys in `meta.references`.

## Pruning Safely

Deleting a file does not delete anything on push unless you ask for it. Remove
`sam.208db72e.json` and try to prune:

```bash
wp bs content push --prune
```

```
Error: Refusing to prune without --yes. Re-run with --dry-run to inspect the plan or --yes to confirm.
```

The dry run shows what would go:

```bash
wp bs content push --prune --dry-run
```

```
action             entity  id   uid          message
...
would-prune-trash  post    537  208db72e-...
```

`push --prune --yes` then moves Sam's post to the trash and reports
`pruned-trash`. Several guards keep this narrow:

- Only entities owned by this content set (`content.id`) are candidates.
- Only configured post types and taxonomies are considered.
- The whole source plan is parsed and validated before anything is written or
  pruned. With a malformed JSON file in the folder, push reports an `error` row
  such as `could not be read: Syntax error` and prunes nothing.

The default action is `trash`. The `blockstudio/content/orphan_action` filter
can return `trash`, `delete`, or `keep` per entity. This keeps terms while
leaving posts on the default:

```php title="functions.php"
add_filter(
	'blockstudio/content/orphan_action',
	function ( string $action, string $type ) {
		return 'term' === $type ? 'keep' : $action;
	},
	10,
	2
);
```

With it, an orphaned term is reported as `would-prune-keep` instead of
`would-prune-trash`.

## Media

Media files are never copied. `content.media` decides what happens to declared
attachment references:

- `"manifest"` (default) stores attachment UIDs and lists them in
  `content/media/manifest.json` with path, MIME type, and alt text. Push
  requires each referenced attachment UID to exist in the target, so move the
  uploads with your usual media workflow first.
- `"none"` leaves declared attachment references out of the files. Jane's JSON
  then only carries `_acme_role`. Because an omitted key is not applied on push,
  an existing target post keeps its current thumbnail.

## Locking an Entity

Sometimes a target environment needs to keep its own version of one post. Set
the `_blockstudio_content_locked` meta to a truthy value on that post, and push
skips it with a `locked` row and the message "Locked entity skipped." Delete
the meta to include it again.

## Ownership Rules

- Posts managed by file-based pages are excluded by default. With
  `includePageSyncManaged: true`, Content Sync may sync their configured meta,
  but Page Sync still owns their `post_content`.
- Authors are ignored by default because users are not synced. With
  `authors: "login"`, post files store the author's login and push resolves it
  to an existing user; a missing user is a preflight error.
- `pull` never deletes files. When a database entity is gone, pull reports its
  file as stale and leaves the cleanup to you.

## When Not to Use It

Content Sync suits curated, low-churn content: dozens or hundreds of entries,
up to the low thousands when the data is structured and split into focused post
types. It is not a replacement for database backups or migrations. Orders,
form submissions, logs, analytics, and high-volume editorial content belong in
those tools. Taxonomy definitions, media binaries, and IDs inside block markup
are outside its scope.

## Next Steps

- [Content Sync reference](/docs/content-sync): all configuration keys, file
  formats, and stored sync state.
- [Building a Documentation Site](/guides/documentation-site): content that
  starts in files and syncs into WordPress the other way round.
- [Building File-Based Pages](/guides/file-based-pages): pages whose structure
  is owned by templates in the theme.
