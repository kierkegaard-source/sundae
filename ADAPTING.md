# Adapting the variant preview

## More sections, or sections outside the home page

`SECTIONS` is a flat list, so adding a fourth or fifth versioned section costs
one entry plus one entry in `variant-map.tsx`. The panel grows with it and needs
no changes.

Past roughly six sections the panel gets tall. Group it by page rather than
adding scroll: give each entry a `page` field and render one collapsible group
per page. Do not paginate. The point is seeing everything at once.

## More than one previewable page

The single `/preview` route only covers one page. For several:

- `/preview/[...slug]` with a map from slug to shell, or
- one route per page (`/preview`, `/preview/pricing`), each with its own shell.

The cookie is shared. Only scope keys by page (`"home.hero"`, `"pricing.hero"`)
if the same section id would otherwise mean two different things on two pages.
A section that is the same component reused across pages (a shared CTA, a
contact block) should stay one entry, unscoped, so picking a version in one
place picks it everywhere it's used.

`<VariantPanel>` takes an optional `page` prop. Tag page-specific sections in
`variants.ts` with a matching `page: "..."` field and leave shared sections
untagged. The panel then only shows chips relevant to the current page, instead
of chips that do nothing because their section isn't on it.

### Staying in preview while browsing the site

A client clicking the site's own nav links (not the panel) normally leaves
preview as soon as they leave the page they landed on. `/about` renders the
public version, cookie or no cookie, since only `/preview/about` reads it.

To keep the real nav links in preview until the user signs out, add a
`proxy.ts` (Next 16; `middleware.ts` before it) at the project root (or
`src/`). It rewrites a previewable public path to its `/preview` counterpart
whenever `STUDIO_COOKIE` is present. Use `NextResponse.rewrite`, not
`redirect`, so the URL bar keeps showing `/about` while the response comes from
`/preview/about`:

```ts
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { STUDIO_COOKIE } from "@/lib/variants";

const PREVIEWABLE_PATHS: Record<string, string> = {
  "/": "/preview",
  "/about": "/preview/about",
};

export function proxy(request: NextRequest) {
  const target = PREVIEWABLE_PATHS[request.nextUrl.pathname];
  if (!target || !request.cookies.has(STUDIO_COOKIE)) return NextResponse.next();
  const url = request.nextUrl.clone();
  url.pathname = target;
  return NextResponse.rewrite(url);
}

// Must be a static array literal: Next parses `matcher` at build time.
export const config = { matcher: ["/", "/about"] };
```

This only checks that the cookie is *present*, not that it is valid.
Proxy/middleware can't call `isStudioAuthed()`, because it depends on
`cookies()` from `next/headers`, which isn't available there. Real auth still
happens in the destination route. A forged or stale cookie only means the
rewrite target shows its login screen instead of the public page; it never
grants access. "Sign out" already deletes `STUDIO_COOKIE`, so it works as the
exit with no extra control. Anonymous visitors never have the cookie, so the
public route's static rendering is untouched. Confirm that in the build's route
table as usual.

Keep `PREVIEWABLE_PATHS` and the `matcher` array in sync by hand, and add an
entry to both when a new page gets a `/preview/<path>` route.

## Showing a client

This is covered by `applyParams` in `variants.ts` and the panel's **Copy
link** button (see "Sharing a specific combination" in SKILL.md). A query param
(`?hero=v1`) wins over the cookie without being saved to it, and goes through
the same registry check as the cookie, so a hand-edited link can't name a
component that doesn't exist.

What it doesn't cover: named snapshots, meaning a short list of saved
combinations in the registry ("Option A", "Option B") that the panel applies in
one click. These help when a client needs to compare more combinations than fit
in a readable URL. A URL already works as a snapshot for a handful of
`key=value` pairs, so only build this once that stops being enough.

## Making a selection go live for everyone

This is a different feature, not a setting. It needs:

- A shared store (Vercel KV, Upstash Redis, or a row in an existing database).
  A cookie can't do it.
- The public route reading that store, which makes it dynamic or requires
  `revalidateTag` plumbing to keep it cached.
- A second permission level, or anyone who can preview can deploy.

Say all three out loud before starting. A reviewer asking to "just make this the
default" usually means "change the import for me", which is a one-line commit.

## Other stacks

The design has four parts. Only the first is Next-specific.

| Part | Next.js App Router | Elsewhere |
| --- | --- | --- |
| Keep the public route static | separate route reads the cookie | same idea: one route static, one dynamic |
| Registry + validation | `variants.ts` | unchanged, it is plain TypeScript |
| Session | HMAC cookie via Server Function | any request handler that can set a cookie |
| Panel | client component + `router.refresh()` | any client-side re-fetch of the page |

- **Remix / React Router**: the loader reads the cookie, an action writes it.
  `revalidate` replaces `router.refresh()`.
- **Astro**: the preview page needs `export const prerender = false`; the panel
  is an island.
- **SvelteKit**: the `+page.server.ts` load function reads it, a form action
  writes it.
- **Vite SPA, no server**: put the selection in `localStorage` and read it in a
  provider. Auth stops being meaningful because anyone with the URL can
  switch, so either drop the password or put the whole preview build behind
  host-level auth.

## Pitfalls

**The public route silently goes dynamic.** Any `cookies()`, `headers()`, or
`searchParams` access anywhere in its tree does it, including inside a component
someone adds later. Check the build's route table, not the source.

**`router.refresh()` is required.** The Server Function writes the cookie but
does not re-render the page that reads it. Without the refresh the panel updates
its own state and nothing else changes, which looks like a broken switch.

**The variant cookie must not be httpOnly.** Nothing in it is secret, and a
readable cookie is easier to debug. The *session* cookie is the httpOnly one.

**Old versions rot.** They still compile, so nothing warns you when a shared
component they import changes shape. Either build every version in CI (they are
in the tree, so `tsc` already covers them) or accept that an old version may
render wrong and check it before showing anyone.

**Do not delete a version because it lost.** Keeping it is the premise of this
setup. Use the registry note to record *why* it lost, since that is what gets
forgotten.
