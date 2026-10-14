---
title: Personalized Fragments on Cached Pages
description: Keep pages fully cached and still greet signed-in visitors or show a live cart count, using dynamic block islands and their signed fragment endpoint.
path: "block-islands"
order: 17
section: "Guides"
meta_title: "Personalized Fragments on Cached Pages"
meta_description: "Keep pages fully cached and still greet signed-in visitors or show a live cart count, using dynamic block islands and their signed fragment endpoint."
---

# Personalized Fragments on Cached Pages

A page served from a static cache is the same for everyone. That is the point
of caching it, and it is also the problem: the header wants to say "Hi, Ada"
to a signed-in customer, and the cart icon wants to show three items. If the
template branches on the current user, the cache either stores one visitor's
greeting for everyone or has to skip the page entirely.

Blockstudio's dynamic islands split those two concerns. The cached HTML
contains a cache-safe placeholder. After the page loads, a small runtime asks
WordPress for the personal fragment in the visitor's own request and swaps it
in. The page stays cacheable, and only the fragment is live.

This guide builds two islands, a greeting and a cart count, and walks through
what the cached page contains, what the fragment request looks like, and how
the endpoint decides who the visitor is. It pairs with
[Serving WordPress as Static HTML](/guides/static-prerendering).

## How a dynamic island works

1. The block renders its placeholder inside a marker element. The marker
   carries the block name, the allow-listed attributes, and a server-generated
   signature.
2. Because the rendered page contains a marker, Blockstudio injects the island
   runtime. Pages without islands ship no island JavaScript.
3. The runtime collects ready markers and sends one batched `POST` to
   `/wp-json/blockstudio/v1/island/render`.
4. The endpoint verifies each signature, renders the block in the visitor's
   request context, and returns the fragments.
5. The runtime swaps each placeholder and dispatches events.

In the block editor the block renders normally, without a placeholder.

## Step 1: The greeting block

Create the block with three files:

```
blocks/
└── greeting/
    ├── block.json
    ├── placeholder.php
    └── index.php
```

```json title="block.json"
{
  "apiVersion": 3,
  "name": "acme/greeting",
  "title": "Greeting",
  "category": "widgets",
  "icon": "admin-users",
  "description": "Account link that greets signed-in visitors.",
  "blockstudio": {
    "island": {
      "mode": "dynamic",
      "tag": "span",
      "attributes": ["guestLabel"],
      "cache": {
        "ttl": 300,
        "per": "user"
      }
    },
    "attributes": [
      { "id": "guestLabel", "type": "text", "label": "Guest label", "default": "Sign in" }
    ]
  }
}
```

`mode: "dynamic"` is what makes this an island with a fragment request.
`tag` sets the marker element, so the island can sit inline in a navigation
bar. `attributes` is the allow-list of block attributes that travel with the
fragment request; anything not listed is neither sent nor signed. `cache` is
covered further down.

The placeholder is what the cached page contains. It must be safe to show to
every visitor, so it has no user data. An "Account" link works for everyone:

```php title="placeholder.php"
<a href="<?php echo esc_url( home_url( '/account/' ) ); ?>">Account</a>
```

The main template renders the real fragment:

```php title="index.php"
<?php
$user = wp_get_current_user();
?>
<?php if ( $user->exists() ) : ?>
  <a href="<?php echo esc_url( home_url( '/account/' ) ); ?>">
    <?php echo esc_html( sprintf( 'Hi, %s', $user->display_name ) ); ?>
  </a>
<?php else : ?>
  <a href="<?php echo esc_url( wp_login_url() ); ?>">
    <?php echo esc_html( $a['guestLabel'] ); ?>
  </a>
<?php endif; ?>
```

Branching on the current user is fine here: this template only runs for the
fragment request, never for the cached page.

Place it wherever the header renders:

```php title="header.php"
<?php echo bs_block( array( 'name' => 'acme/greeting' ) ); ?>
```

Block tags work too: `<bs:acme-greeting />` or
`<block name="acme/greeting" />`.

## Step 2: What the cached page contains

Rendered on the server, the block produces only the marker and placeholder:

```html
<span data-bs-island="acme/greeting" data-bs-island-mode="dynamic" data-bs-island-phase="placeholder" data-bs-island-props="{&quot;guestLabel&quot;:&quot;Sign in&quot;}" data-bs-island-signature="a7311ba9f6abf3c993edfdd7d49d2fa23bfa068f715b96637c35ef30de8b2043" data-bs-island-loading="eager"><!--blockstudio/acme/greeting--><a href="https://example.com/account/">Account</a>
</span>
```

Render it once as an anonymous visitor and once as a signed-in user, and the
two strings are byte-identical. That is exactly the property a static
prerender with `serveLoggedIn` enabled needs: whoever triggers the render, the
stored document is the same, and nothing personal can end up in it.

## Step 3: The fragment request

The runtime posts every ready island in one request:

```json
{
    "islands": [
        {
            "clientId": "a1",
            "name": "acme/greeting",
            "attributes": {
                "guestLabel": "Sign in"
            },
            "signature": "a7311ba9f6abf3c993edfdd7d49d2fa23bfa068f715b96637c35ef30de8b2043"
        }
    ]
}
```

The response is keyed by `clientId`. For a signed-in visitor:

```json
{
    "a1": "<!--blockstudio/acme/greeting-->  <a href=\"https://example.com/account/\">\n    Hi, Ada  </a>\n"
}
```

An entry that fails verification comes back as an error code instead of
HTML, without failing the rest of the batch. Here the second entry changed
`guestLabel` without a matching signature, and the third named a block that
is not a dynamic island:

```json
{
    "a1": "<!--blockstudio/acme/greeting-->  <a href=\"https://example.com/wp-login.php\">\n    Sign in  </a>\n",
    "a2": {
        "error": "blockstudio_island_invalid_signature"
    },
    "a3": {
        "error": "blockstudio_island_not_allowed"
    }
}
```

Every response carries
`Cache-Control: no-store, no-cache, must-revalidate, max-age=0`,
`Pragma: no-cache`, and `X-Robots-Tag: noindex`. The endpoint lives under
`/wp-json`, which the static prerender always bypasses, so neither the origin
cache nor a CDN that respects origin headers will store a fragment.

## Who is the visitor

The runtime sends the request with `credentials: 'same-origin'`, so the
browser includes the WordPress login cookie. The WordPress REST API normally
ignores cookie authentication without a nonce, and a nonce cannot live in a
cached page. The island endpoint handles this itself: for a same-origin
browser request, it validates the `logged_in` cookie and restores that user
before rendering.

Same-origin is decided from the `Sec-Fetch-Site` header and, when present,
the `Origin` header compared against `home_url()`. A request from another
origin that happens to carry the cookie renders as anonymous, so a request
from another site never renders a visitor's personal fragment. In practice:

| Request | Renders as |
| --- | --- |
| Same-origin fetch with a valid login cookie | the signed-in user |
| Cross-origin request with the same cookie | anonymous |
| No cookie | anonymous |

## Step 4: A cart count that refreshes itself

The second island shows the other placeholder style and two runtime options.
Instead of a separate placeholder file, the template checks
`$isIslandPlaceholder`:

```json title="block.json"
{
  "apiVersion": 3,
  "name": "acme/cart-count",
  "title": "Cart Count",
  "category": "widgets",
  "icon": "cart",
  "description": "Number of items in the visitor's cart.",
  "blockstudio": {
    "island": {
      "mode": "dynamic",
      "loading": "visible",
      "event": "acme:cart-updated"
    },
    "attributes": []
  }
}
```

```php title="index.php"
<?php
$count = (int) apply_filters( 'acme/cart_count', 0 );
?>
<?php if ( $isIslandPlaceholder ) : ?>
  <a href="/cart/" class="cart-count">Cart</a>
<?php else : ?>
  <a href="/cart/" class="cart-count">
    Cart <span class="cart-count__badge"><?php echo esc_html( (string) $count ); ?></span>
  </a>
<?php endif; ?>
```

The same flags exist in every template language: `isIsland`,
`isIslandPlaceholder`, `isIslandFragment`, and `islandPhase` (`"normal"`,
`"hydrate"`, `"placeholder"`, or `"fragment"`). Here the count comes from an
`acme/cart_count` filter that your commerce code fills; with it returning
`3`, the endpoint returns:

```json
{"c1":"<!--blockstudio/acme/cart-count-->  <a href=\"/cart/\" class=\"cart-count\">\n    Cart <span class=\"cart-count__badge\">3</span>\n  </a>\n"}
```

`loading: "visible"` defers the request until the marker enters the viewport,
using `IntersectionObserver`. Visible islands that appear together are still
batched into one request. `event` names a window event that re-fetches the
island, so after an add-to-cart call your script only has to announce it:

```js
window.dispatchEvent(new Event('acme:cart-updated'));
```

## Reacting in frontend code

Events bubble from the marker, so one listener on `document` covers every
island. `event.detail.name` holds the block name:

```js
document.addEventListener('blockstudio:island:rendered', (event) => {
  if (event.detail.name !== 'acme/cart-count') return;
  event.target.querySelector('.cart-count__badge')?.classList.add('is-fresh');
});

document.addEventListener('blockstudio:island:error', (event) => {
  console.warn('Island failed', event.detail.name, event.detail.error);
});
```

After a swap the runtime dispatches `blockstudio:island:rendered`, then
`blockstudio:island:hydrate`. On failure the placeholder stays in place and
`blockstudio:island:error` fires. Hydrated islands (`"island": "hydrate"`)
skip the request entirely: their full HTML is in the page and they only
receive the `hydrate` event, which suits cache-safe interactive blocks such as
tabs.

## Fragment caching

Fragments are rendered on every request by default. The greeting above opts
into a short cache:

```json
{
  "cache": {
    "ttl": 300,
    "per": "user"
  }
}
```

`per: "user"` varies the cached fragment by WordPress user ID, and anonymous
requests are never cached under it, so two anonymous visitors cannot share an
entry meant for a user. `per: "global"` shares one fragment for the same block
and attributes, which suits content that is live but not personal, such as a
stock level. `ttl` defaults to 60 seconds, and `cache: true` is a 60-second
global cache.

## The security model

The endpoint is public, but it is not a general block renderer. It renders an
entry only when all of these hold:

- the block is registered, dynamic, and has `island.mode` set to `dynamic`
- the signature matches the block name and the attributes that survive the
  filter: only keys in both the block schema and the island allow-list

The signature is an HMAC-SHA256 over the normalized block name and
attributes, keyed with the serving site's `auth` salt. Signatures are created
at render time on that site and are never baked into a theme. Two
consequences follow. A document rendered on staging carries staging
signatures, so render documents on the site that serves them. And rotating
the WordPress salts invalidates every signature in stored documents, so purge
the static prerender after a salt rotation.

One request accepts up to 50 islands; more returns HTTP 413. Change the limit
with `blockstudio/islands/max_per_request`. Signature hooks
(`blockstudio/islands/signature_payload`, `blockstudio/islands/signature`,
`blockstudio/islands/verify_signature`) exist for hosts that need a different
scheme.

## When not to use an island

Fragments are not in the initial HTML, so crawlers do not see them. Keep
SEO-relevant content in the normal render. Use dynamic islands for what can
arrive after the page shell: account links, cart state, recommendations, and
permission-gated controls. When the whole page is personal, such as an
account dashboard, list its path in `dynamicPaths` instead and render it live.

## Next steps

- [Islands reference](/docs/blocks/islands): every option, placeholder lookup order, PHP API, and hooks.
- [Serving WordPress as Static HTML](/guides/static-prerendering): the cache these islands are designed for.
- [Static Prerendering reference](/docs/production/static-prerendering): `serveLoggedIn`, dynamic paths, and early serving.
- [Interactive Components](/guides/interactive-components): client behavior for blocks that need more than a mount event.
