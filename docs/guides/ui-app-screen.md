---
title: Building an App Screen with the Bundled UI
description: Build a working CRUD screen from one block folder with the bundled bsui components, a db.php data model, an RPC action, and an Interactivity API store.
path: "ui-app-screen"
order: 12
section: "Guides"
meta_title: "Building an App Screen with the Bundled UI"
meta_description: "Build a working CRUD screen from one block folder with the bundled bsui components, a db.php data model, an RPC action, and an Interactivity API store."
---

# Building an App Screen with the Bundled UI

Most WordPress projects eventually need a screen that is more application than page: a list of records, a button that opens a form, some feedback when a save goes through. The usual answer is a JavaScript framework, a set of REST controllers, and a component library, all maintained next to the theme.

Blockstudio already ships each of those pieces. [`db.php`](/docs/blocks/block-api/database) gives a block storage, validation, and CRUD endpoints. [`rpc.php`](/docs/blocks/block-api/rpc) adds custom server actions. The [bundled UI components](/docs/blocks/ui-components) provide the dialog, form fields, buttons, badges, and toast. An [Interactivity API](/docs/blocks/interactivity) store connects them. This guide builds one screen end to end in a single block folder:

- A table of projects, rendered on the server and kept in sync on the client.
- A **New project** dialog with a form that validates against the schema.
- **Archive** and **Restore** buttons that call an RPC function with an optimistic update and a rollback.
- **Delete** buttons that use the data API directly.
- A toast after a successful create and another when a change does not save.

## Before you start

The bundled components are opt-in. Enable them in `blockstudio.json`:

```json title="blockstudio.json"
{
  "$schema": "https://blockstudio.dev/schema/blockstudio",
  "ui": {
    "enabled": true
  }
}
```

The screen lives in one block:

```
acme/
└── blockstudio/
    └── projects/
        ├── block.json
        ├── db.php
        ├── rpc.php
        ├── index.php
        ├── script.inline.js
        └── style.inline.css
```

## Step 1: The data model

```php title="db.php"
<?php
return [
    'storage'    => 'sqlite',
    'capability' => [
        'create' => 'edit_posts',
        'read'   => 'edit_posts',
        'update' => 'edit_posts',
        'delete' => 'edit_posts',
    ],
    'fields'     => [
        'name'   => [
            'type'      => 'string',
            'required'  => true,
            'minLength' => 2,
            'maxLength' => 80,
        ],
        'owner'  => [
            'type'     => 'string',
            'format'   => 'email',
            'required' => true,
        ],
        'status' => [
            'type'     => 'string',
            'enum'     => ['active', 'archived'],
            'required' => true,
        ],
    ],
];
```

Every operation requires the `edit_posts` capability, so the endpoints answer `401` to a logged-out request and only editors and above can change data. SQLite storage keeps the records in `projects/db/default.sqlite`, next to the code.

`status` is `required` rather than carrying a `default`. With SQLite and table storage the schema does not fill in a missing value on create, so a record created without `status` is stored with an empty one. Making the field required, and sending it from the form, keeps every row valid.

Seed a couple of records from the command line:

```bash
wp bs db create acme/projects --name="Website relaunch" --owner=ana@example.com --status=active
wp bs db create acme/projects --name="Q3 report" --owner=ben@example.com --status=archived
wp bs db list acme/projects
```

```
Success: Record created (ID: 1).
Success: Record created (ID: 2).
id	name	owner	status	created_at	updated_at
2	Q3 report	ben@example.com	archived	...
1	Website relaunch	ana@example.com	active	...
```

The list comes back newest first, which is the order the table uses.

## Step 2: A server action

Archiving is not a plain field edit from the user's point of view, so it gets a named function:

```php title="rpc.php"
<?php
use Blockstudio\Db;

return [
    'set_status' => [
        'callback'   => function (array $params) {
            $id     = (int) ($params['id'] ?? 0);
            $status = (string) ($params['status'] ?? '');
            $db     = Db::get('acme/projects');

            if (!$db->get_record($id)) {
                return new \WP_Error('not_found', 'Project not found.', ['status' => 404]);
            }

            return $db->update($id, ['status' => $status]);
        },
        'capability' => 'edit_posts',
    ],
];
```

`Db::update()` validates against the schema, so the `enum` in `db.php` still guards the value. Calling the function with an unknown status returns the same error shape as the data API:

```json
{"code":"blockstudio_db_validation","message":"Validation failed.","data":{"status":400,"errors":{"status":["Must be one of: active, archived."]}}}
```

The function is callable from the command line too:

```bash
wp bs rpc call acme/projects set_status --id=2 --status=active
```

```
{
    "id": 2,
    "name": "Q3 report",
    "owner": "ben@example.com",
    "status": "active",
    ...
}
```

## Step 3: The block definition

```json title="block.json"
{
  "$schema": "https://blockstudio.dev/schema/block",
  "apiVersion": 3,
  "name": "acme/projects",
  "title": "Projects",
  "category": "widgets",
  "icon": "list-view",
  "supports": {
    "interactivity": true
  },
  "blockstudio": {
    "interactivity": {
      "enqueue": true
    }
  }
}
```

`supports.interactivity` makes WordPress process the template's directives on the server, which is what renders the table rows before any JavaScript runs.

## Step 4: The template

```php title="index.php"
<?php
$can_edit = current_user_can('edit_posts');
$projects = $can_edit ? \Blockstudio\Db::get('acme/projects')->list() : [];

wp_interactivity_state('acme/projects', [
    'projects'    => array_values($projects),
    'hasProjects' => !empty($projects),
    'notice'      => '',
    'isArchived'  => function () {
        $context = wp_interactivity_get_context();

        return 'archived' === ($context['project']['status'] ?? '');
    },
]);
?>
<div
    useBlockProps
    class="projects"
    data-wp-interactive="acme/projects"
    data-wp-on-document--formsuccess="actions.created"
>
<?php if (!$can_edit) : ?>
    <p>Sign in with an editor account to manage projects.</p>
<?php else : ?>
    <div class="projects__bar">
        <bs:bsui-text content="Projects" variant="title" tag="h2" />
        <bs:bsui-dialog>
            <bs:bsui-dialog-trigger trigger_label="New project" />
            <bs:bsui-dialog-backdrop />
            <bs:bsui-dialog-popup>
                <bs:bsui-dialog-header>
                    <bs:bsui-dialog-title content="New project" />
                    <bs:bsui-dialog-description content="Projects start out active." />
                </bs:bsui-dialog-header>
                <bs:bsui-dialog-content>
                    <bs:bsui-form block="acme/projects">
                        <bs:bsui-field name="name">
                            <bs:bsui-field-label text="Name" />
                            <bs:bsui-input name="name" placeholder="Spring campaign" required="true" />
                            <bs:bsui-field-error />
                        </bs:bsui-field>
                        <bs:bsui-field name="owner">
                            <bs:bsui-field-label text="Owner email" />
                            <bs:bsui-input name="owner" type="email" placeholder="owner@example.com" required="true" />
                            <bs:bsui-field-error />
                        </bs:bsui-field>
                        <input type="hidden" name="status" value="active" />
                        <bs:bsui-space size="2" />
                        <bs:bsui-button label="Create project" />
                    </bs:bsui-form>
                </bs:bsui-dialog-content>
                <bs:bsui-dialog-footer>
                    <bs:bsui-dialog-close label="Cancel" />
                </bs:bsui-dialog-footer>
            </bs:bsui-dialog-popup>
        </bs:bsui-dialog>
    </div>

    <table class="projects__table">
        <thead>
            <tr>
                <th scope="col">Name</th>
                <th scope="col">Owner</th>
                <th scope="col">Status</th>
                <th scope="col">Actions</th>
            </tr>
        </thead>
        <tbody>
            <template data-wp-each--project="state.projects" data-wp-each-key="context.project.id">
                <tr>
                    <td data-wp-text="context.project.name"></td>
                    <td data-wp-text="context.project.owner"></td>
                    <td>
                        <span data-wp-bind--hidden="state.isArchived"><bs:bsui-badge label="Active" variant="success" /></span>
                        <span data-wp-bind--hidden="!state.isArchived"><bs:bsui-badge label="Archived" variant="secondary" /></span>
                    </td>
                    <td class="projects__actions">
                        <span data-wp-on--click="actions.toggleArchived">
                            <span data-wp-bind--hidden="state.isArchived"><bs:bsui-button label="Archive" variant="outline" size="sm" /></span>
                            <span data-wp-bind--hidden="!state.isArchived"><bs:bsui-button label="Restore" variant="outline" size="sm" /></span>
                        </span>
                        <span data-wp-on--click="actions.remove"><bs:bsui-button label="Delete" variant="ghost" size="sm" /></span>
                    </td>
                </tr>
            </template>
        </tbody>
    </table>

    <p class="projects__empty" data-wp-bind--hidden="state.hasProjects">No projects yet.</p>

    <div class="projects__toasts">
        <bs:bsui-toast-provider>
            <div data-wp-interactive="acme/projects" data-wp-bind--hidden="!state.isCreatedNotice" data-wp-on--click="actions.dismissNotice">
                <bs:bsui-toast message="Project created." />
            </div>
            <div data-wp-interactive="acme/projects" data-wp-bind--hidden="!state.isFailedNotice" data-wp-on--click="actions.dismissNotice">
                <bs:bsui-toast message="That change was not saved." />
            </div>
        </bs:bsui-toast-provider>
    </div>
<?php endif; ?>
</div>
```

Four parts of this template deserve a closer look.

**Server state seeds the first paint.** `wp_interactivity_state()` hands the records to both the server-side directive processor and the client store. The `data-wp-each` template expands into real rows on the server, one `tr` per record. `isArchived` is a closure: WordPress evaluates it for each row during server processing, with `wp_interactivity_get_context()` returning that row's context, so archived rows show the right badge and button before hydration. In the browser the store's getter of the same name takes over. `hasProjects` is a plain value for the same reason: without it, the server would not know whether to hide the empty-state paragraph.

**The dialog and form are system components.** `trigger_label` is forwarded to the `bsui/button` inside the trigger, as described in [UI Composition](/ui/composition#trigger-forwarding). `bsui/form` with `block="acme/projects"` serializes its fields with `FormData` and sends them to that block's create endpoint. Each `bsui/field` carries the name of its input, so the per-field errors from the schema land under the right control. Submitting the empty form shows "Must be at least 2 characters." under Name and "Must be a valid email address." under Owner email, plus "Validation failed." at the bottom of the form. The hidden `status` input travels with the form data, which is how new projects satisfy the required field.

**The table is your own markup.** `bsui/table` suits rows that are authored in the template: its header cells sort by moving the existing `tr` elements around, which would fight `data-wp-each` for ownership of the rows. Before Blockstudio 7.7, its parts also put a `div` directly inside `table`, `thead`, `tbody`, and `tr`, which browsers move out of the table. For rows that come from a store, write the `table` element yourself and keep the system components inside the cells. The badges and buttons in the row template are ordinary `bsui/badge` and `bsui/button` tags. Each button sits in a `span` that carries the click directive, so the button stays the system button while the action belongs to your store.

**The toast is presentational.** `bsui/toast-provider` renders a polite live region and `bsui/toast` renders a status message with a dismiss button. The provider does not position itself on the screen, and the dismiss button does not hide a toast that was rendered from markup. The screen therefore does both: a wrapper with `position: fixed` places the region, and each toast sits in a `div` whose `hidden` binding and click handler belong to the screen's store. A click on the dismiss button bubbles up to that `div`.

## Step 5: The store

```js title="script.inline.js"
import { store, getContext } from '@wordpress/interactivity';

const BLOCK = 'acme/projects';
let noticeTimer;

// bs.fn() and bs.db() resolve with the error body on a failed request.
// Throwing here is what lets bs.mutate() roll the optimistic change back.
const ok = (request) =>
    request.then((result) => {
        if (result?.code) {
            throw result;
        }
        return result;
    });

const notify = (notice) => {
    state.notice = notice;
    clearTimeout(noticeTimer);
    noticeTimer = setTimeout(() => {
        state.notice = '';
    }, 4000);
};

const { state } = store(BLOCK, {
    state: {
        get hasProjects() {
            return state.projects.length > 0;
        },
        get isArchived() {
            return getContext().project.status === 'archived';
        },
        get isCreatedNotice() {
            return state.notice === 'created';
        },
        get isFailedNotice() {
            return state.notice === 'failed';
        },
    },
    actions: {
        created(event) {
            const record = event.detail;
            if (!record?.id || !('owner' in record)) {
                return;
            }

            event.preventDefault();
            state.projects = [record, ...state.projects];
            store('bsui/dialog').actions.close();
            notify('created');
        },
        dismissNotice() {
            state.notice = '';
        },
        *toggleArchived() {
            const project = getContext().project;
            const status = project.status === 'archived' ? 'active' : 'archived';

            try {
                yield bs.mutate({
                    fn: () => ok(bs.fn('set_status', { id: project.id, status }, BLOCK)),
                    state,
                    key: 'projects',
                    action: 'update',
                    id: project.id,
                    optimistic: { status },
                });
            } catch (error) {
                notify('failed');
            }
        },
        *remove() {
            const project = getContext().project;

            try {
                yield bs.mutate({
                    fn: () => ok(bs.db(BLOCK).delete(project.id)),
                    state,
                    key: 'projects',
                    action: 'delete',
                    id: project.id,
                });
            } catch (error) {
                notify('failed');
            }
        },
    },
});
```

**Reacting to the form.** On a successful save, `bsui/form` dispatches a `formsuccess` event that bubbles, can be cancelled, and carries the created record in `event.detail`. A failed save dispatches `formerror` with the error body. The listener sits on the document (`data-wp-on-document--formsuccess`) rather than on the screen's root element because an open dialog popup is moved to `document.body`, so its events no longer bubble through the block. The `owner` check skips events from other forms on the same page.

Calling `event.preventDefault()` stops the form from swapping its fields for the success message; the form still resets itself. The action then prepends the record, closes the dialog with the `bsui/dialog` store's `close` action, and raises the toast. `close` closes the top open dialog and returns focus to its trigger, so after a create the keyboard focus is back on **New project**.

**Rolling back on errors.** `bs.mutate()` applies the optimistic change immediately and restores the previous values when the promise from `fn` rejects. `bs.fn()` and `bs.db()` do not reject on HTTP errors: a `WP_Error` from the RPC function, a validation failure, or a missing record all resolve with the error body. The `ok()` helper turns a result with a `code` into a rejection, so the row flips back and the failure toast appears. Without it, a failed update would merge the error body into the row and a failed delete would leave the row removed.

**Naming the block.** Blockstudio prints inline scripts as `<script type="module">`, and module scripts have no `document.currentScript`, so `bs.fn()` cannot detect which block is calling. Pass the block name as the third argument, as the store does with `BLOCK`.

## Step 6: Put the screen on a page

A [file-based page](/docs/pages-and-patterns/pages) places the block with its tag:

```json title="pages/projects/page.json"
{
  "$schema": "https://blockstudio.dev/schema/page",
  "name": "projects",
  "title": "Projects",
  "slug": "projects",
  "postStatus": "private"
}
```

```php title="pages/projects/index.php"
<h1>Projects</h1>
<bs:acme-projects />
```

The parser turns the tag into a native block:

```html
<!-- wp:heading {"level":1} --><h1 class="wp-block-heading">Projects</h1><!-- /wp:heading --><!-- wp:acme/projects /-->
```

Run `wp bs pages sync` to create the page. `postStatus: "private"` keeps it away from anonymous visitors, who would only see the sign-in message anyway.

## What the screen does at runtime

With the page open as an editor:

1. The table arrives with both rows rendered, the archived row showing its **Archived** badge and a **Restore** button.
2. **New project** opens the dialog. The popup and backdrop move to `document.body`, focus lands in the Name field, and Escape or **Cancel** closes it again.
3. Submitting valid values sends one `POST` to `/wp-json/blockstudio/v1/db/acme-projects/default`. The dialog closes, the new row appears at the top, and "Project created." shows in the corner for four seconds.
4. **Archive** flips the badge at once and sends `set_status` through `/wp-json/blockstudio/v1/fn/acme/projects/set_status`. If the record was deleted elsewhere in the meantime, the function returns its `404` error, the row returns to **Active**, and "That change was not saved." appears.
5. **Delete** removes the row immediately. Deleting the last one reveals "No projects yet."

## Styling

The screen's own CSS reads the library tokens, so the table matches the components around it and follows any theme override of the `--bs-ui-*` properties:

```css title="style.inline.css"
.projects__table {
    width: 100%;
    border-collapse: collapse;
    font-size: var(--bs-ui-font-size);
}

.projects__table th,
.projects__table td {
    padding: var(--bs-ui-space-2) var(--bs-ui-space-3);
    border-bottom: 1px solid var(--bs-ui-border);
    text-align: left;
}

/* ... */

.projects__toasts {
    position: fixed;
    right: var(--bs-ui-space-4);
    bottom: var(--bs-ui-space-4);
    z-index: 40;
}
```

The `z-index` of `40` keeps the toast region under the dialog backdrop, which sits at `50`. To retheme the whole screen, override tokens as described under [theming](/docs/blocks/ui-components#theming); the components and the table follow.

## Next steps

- [UI Components](/docs/blocks/ui-components): the design system, tokens, and the full component set.
- [UI Composition](/ui/composition): compound families, trigger forwarding, and the layering model behind the dialog.
- [Database](/docs/blocks/block-api/database): storage modes, access control, `bs.db()`, and `bs.mutate()`.
- [RPC](/docs/blocks/block-api/rpc): access control, HTTP methods, and cross-block calls.
- [Full-Stack Blocks](/guides/full-stack-blocks): the same building blocks in a todo app and a newsletter signup.
