---
name: variant-preview
description: Installs a private, password-protected /preview route in a Next.js App Router project, with a floating panel for switching between design versions of each section (hero v1/v2/v3, pricing A/B, footer old/new). Visitors are unaffected and the public page stays statically rendered. Use it when a section is being redesigned more than once, when a project keeps several versions of the same component (files suffixed "v1", "v2", "-v2", or an old/new pair), when the user wants to compare alternatives before picking one, or when they need to show a client options without changing the live site. Triggers include "version panel", "variant switcher", "compare designs", "switch between component versions", "design preview", "A/B preview", "show the client alternatives", and requests to try layouts without editing imports by hand. Suggest it when a second version of an existing section appears in a project, even if the user has not asked for a switcher yet.
---

# Versioned sections with a private preview panel

When a section gets redesigned more than once, keeping every version in the
repo is better than burying the old ones in git history, as long as switching
between them is cheap. Editing an import to compare two heroes is a bad way to
judge them, and it can't be handed to a client.

This skill installs a `/preview` route that renders the real page from a
per-browser cookie, with a floating panel listing every section's versions.
Picking one re-renders the page. Visitors are unaffected and the public route
stays statically rendered.

**Stack:** Next.js App Router (15 or newer, including 16, where Middleware is
renamed Proxy; this skill needs neither) with Tailwind. For other stacks, see
[ADAPTING.md](ADAPTING.md).

## The shape

Eight boilerplate files, plus two changes the installer can't make for you: the
page shell's real section order, and the public route's imports (steps 3 and 4
below). The whole design follows from one constraint:

> Reading a cookie opts a route out of static rendering.

So the **public route never reads the cookie**. It names its versions directly.
Only `/preview` reads it, and only `/preview` goes dynamic. This also keeps the
public bundle carrying the one hero it renders instead of all four.

```
src/lib/variants.ts               registry + cookie parsing (no JSX, imported everywhere)
src/lib/studio-auth.ts            HMAC session, fails closed
src/components/<area>/page-shell.tsx    section order, versioned sections passed in as props
src/components/<area>/variant-map.tsx   id → component; ONLY /preview imports this
src/app/preview/page.tsx          dynamic; auth gate, then the shell + panel
src/app/preview/actions.ts        signIn / signOut / chooseVariant / resetToLive
src/components/studio/variant-panel.tsx  the floating panel
src/components/studio/studio-login.tsx   the password screen
```

`templates/` holds the source of truth for all eight, verbatim, as they should
land in a project. `scripts/sundae.mjs` copies them in and substitutes the
purely mechanical placeholders: project slug and name, the `<area>` folder, the
accent color, and the panel and login copy for `--lang` (see
[Installing](#installing)). Four of the eight are pure boilerplate, fully
derived from template and tokens: `studio-auth.ts`, `preview/actions.ts`,
`variant-panel.tsx`, `studio-login.tsx`. The other four are meant to be
hand-edited for the project: `variants.ts`, `page-shell.tsx`,
`variant-map.tsx`, `preview/page.tsx`. `--check` and `--update` act on exactly
that split (see [Keeping an install current](#keeping-an-install-current)).

Verify the split by reading the build output. The public route must still
print `○ (Static)` and only `/preview` may print `ƒ (Dynamic)`.

## Installing

1. **Ask which sections have versions**, unless it is obvious from the
   filenames (`hero-v1.tsx`, `hero-v2.tsx`). Get a short human label and a
   one-line note for each version. The panel shows them, and "Editorial" tells
   the user more than "v5" does.

2. **Run the installer** to place the eight boilerplate files. It never
   touches a file that already exists, so re-running it after step 3 is safe.
   Use this skill's own directory (the directory this SKILL.md was loaded
   from), not a guessed path:

   ```bash
   node <this-skill's-directory>/scripts/sundae.mjs \
     --project-root . --accent "#<the project's real accent color>" \
     --lang <en|tr, whichever the client-facing copy should be>
   ```

   Omitting `--slug`/`--name` reads them from `package.json`. Omitting
   `--accent` leaves a neutral slate rather than guessing. Omitting `--lang`
   defaults to English. Run with `--help` for the flag list, or read the
   script; it is short. It copies working code, not sketches. Never retype
   these files from memory, even for a one-file fix. Re-run the installer with
   `--force` for that file's template instead, so the source of truth stays the
   `templates/` directory and not whatever got typed into a chat.

3. **Extract the page shell.** Move the page's section order into
   `page-shell.tsx` and take the versioned sections as `ReactNode` props. Both
   routes render this one component, so they can't drift when a section is
   added or moved. This step is easy to skip and expensive to skip, and the
   installer can't do it because it doesn't know the project's sections.

4. **Point the public route at it**, naming its versions with direct imports:

   ```tsx
   export default function Home() {
     return <PageShell hero={<HeroV5 />} footer={<FooterV2 />} />
   }
   ```

5. **Add the password.** Set `STUDIO_PASSWORD` in `.env.local` for local use,
   and tell the user to set it in their host's environment settings. Without
   it, the login screen shows a "set this variable" note instead of a form, so
   a missing variable looks like a bug unless you explain it.

6. **Exclude it from search.** `robots: { index: false, follow: false }` in the
   route's metadata *and* `disallow: "/preview"` in `robots.ts`.

7. **Check the project's stack before trusting the panel and login templates
   as they are.** They use Motion (`motion/react`) for the panel's open and
   close animation and `lucide-react` for its icons (`Layers`, `X`, `Copy`,
   `Check`, `Link2`). Check `package.json` rather than assuming either is
   installed. If one is missing, drop the `AnimatePresence`/`motion` wrapper
   for a plain conditional render and swap the icons for inline SVGs or the
   icon set the project already uses. Nothing else in the panel depends on
   them.

   One more check: if the project's layout wraps everything in
   `<LazyMotion strict>`, the template's plain `motion.*` components **throw
   at runtime** as soon as the panel renders. The fix that leaves the rest of
   the file untouched is aliasing the import:
   `import { m as motion } from "motion/react"`. `m` uses whatever features
   the project's provider already loaded, and the panel only animates
   transform and opacity, so `domAnimation` covers it. Don't make `m` the
   template default: without a `LazyMotion` provider it animates nothing and
   reports nothing, which is worse than the strict-mode error.

8. **Build and check the route table**, then confirm in a browser that the
   cookie does not leak: set a non-default version in `/preview`, load the
   public route, and check it still renders the shipped one. Also open
   `/preview?<section>=<version>` and confirm it overrides the cookie, and
   that clicking a chip while a link is active edits the URL, not the cookie
   (see "Sharing a specific combination" below).

## Rules that matter

**Never let the panel publish.** Shipping a version stays a code change: the
import in the public route plus `DEFAULT_SELECTION`. A panel that writes to
production needs a real store and turns a review tool into a deploy mechanism.
If the user wants that, say so explicitly and treat it as a separate feature.

**Validate on the way in, not on the way out.** `parseSelection` drops any
section or version the registry does not list, so a hand-edited cookie can
never name a component. Keep the registry the only source of truth.

**Re-check auth inside the Server Function.** `chooseVariant` is a real
endpoint that anyone can call, not a UI event. Checking the session in the page
that renders the panel is not enough.

**Fail closed.** Every auth path returns false when `STUDIO_PASSWORD` is unset.
Never fall back to "no password configured means no password required".

**Make the panel look like a tool.** It sits on top of the design being judged.
If it borrows the site's own surfaces, the user starts reading it as part of the
page. Keep it dark, compact, and visually distinct from the site.

**Cover the viewport on the login screen.** The root layout renders the site's
nav and footer around every route, and a login form wedged between them reads as
a page of the site.

## Adding a version later

Three steps, in this order: write the component, add one line in
`variants.ts`, add one line in `variant-map.tsx`. If a step is skipped, the
panel either shows a version that will not render or renders one it can't
show.

## Panel shortcuts

The active chip in each section carries a small dot when it matches
`DEFAULT_SELECTION`. This is the panel's only visible check that the registry
and the public route's imports haven't drifted apart. `[` and `]` step the
last section whose chip was clicked through its versions. They are ignored
while the user is typing in a form field.

## Sharing a specific combination

**Copy link** (next to **Copy selection**) copies the current URL with every
section's choice as a query param, for example `/preview?hero=v3&footer=v2`. A
link is already a snapshot, so there is no separate named-preset feature.
When that link is opened, its params win over the cookie for that page load,
and the panel shows "Showing a shared link" with a **Reset** button that goes
back to whatever the cookie has. While a link is active, clicking a chip edits
the URL instead of writing the cookie. Otherwise the URL would keep overruling
every click, and the chip would look broken.

Two things to know before changing this:

- **Do not wrap `<VariantPanel />` in `<Suspense>`**, even though the Next.js
  docs say `useSearchParams` (which link-mode chip edits rely on) needs one.
  It doesn't here, because the route is already dynamic through `cookies()`.
  Adding the boundary anyway has been observed to break the panel's client
  hydration: the server-rendered HTML looks fine and every chip is visible,
  but clicks do nothing and no console error explains why. Removing the
  boundary fixed it. The template ships without it.
- The copied link uses `window.location.href`'s origin, so from `localhost`
  it copies a link that only opens on the machine it was copied on. The
  button reads **Copy link (local)** in that case as a warning; it doesn't fix
  anything. Copying from the deployed preview URL produces a link a client can
  open.

## Shipping a selection from a pasted JSON

The panel's **Copy selection** button copies a ready-to-paste instruction, not
bare JSON, for example:

```
Ship this variant-preview selection: {"hero":"v3","footer":"v2"}
```

So a whole redesign round ships in one paste instead of naming each section,
and the paste makes sense even in a chat that never mentioned this skill.
Treat "Ship this variant-preview selection: {...}" as this workflow, not as a
JSON blob to interpret from scratch. When it shows up:

1. **Validate the JSON against `SECTIONS` in `variants.ts`** the same way
   `parseSelection` does. A section or version the registry does not list
   means the JSON is stale or hand-edited; ask rather than guessing.
2. **Read `variant-map.tsx`** to resolve each `section → version` id to the
   component and import path it maps to (for example `hero.v3` → `HeroV3` from
   `@/components/<area>/hero-v3`). That file is the only source of truth for
   the id-to-component link, so do not infer the import path from naming
   alone.
3. **Edit the public route** (the file from step 4 of Installing) to import
   exactly those components and pass them to `PageShell` in place of the ones
   it shipped before.
4. **Update `DEFAULT_SELECTION`** in `variants.ts` to match. `/preview` must
   open on the same combination the public route now ships. This step
   prevents the two from disagreeing after a ship.
5. Leave the losing versions' files where they are (see "Do not delete a
   version because it lost" in [ADAPTING.md](ADAPTING.md)).

This is a code change like any other, as in "Never let the panel publish"
above: the paste tells you the combination, it doesn't ship anything by
itself. Nothing about the cookie, the panel, or `variant-map.tsx` changes, and
both routes work as before once this lands.

## Keeping an install current

The installer never overwrites an existing file by default, so a template
improvement never reaches a project that installed it earlier unless someone
updates it.

```bash
node <this-skill's-directory>/scripts/sundae.mjs \
  --project-root <path-to-the-project> --accent "<its accent>" --lang <its lang> \
  --check     # read-only: prints same / differs / missing per file
```

Run `--check` first and read the output before changing anything. Pass the
project's *actual* accent, lang and slug (not the defaults), or every
boilerplate file reports `differs` for a reason unrelated to staleness.
`--slug`/`--name` default to `package.json` as in a normal install, which is
usually right. Only pass them if the slug was set to something else at install
time.

```bash
node <this-skill's-directory>/scripts/sundae.mjs --project-root <path> --accent "<accent>" \
  --lang <lang> --update
```

`--update` rewrites only the four boilerplate files (`studio-auth.ts`,
`preview/actions.ts`, `variant-panel.tsx`, `studio-login.tsx`) and never
touches the four project files, even with `--force`, because those are meant
to stay hand-edited. If `--update` would change the slug embedded in
`studio-auth.ts`, it warns before writing: `TOKEN_MESSAGE` includes the slug,
so a different one invalidates every signed-in session. Rebuild and recheck
the route table afterward (step 8). A template change that alters what a
project file needs to pass (a new prop, a new export) shows up there as a type
error, not during `--update`.

If an install has local changes worth keeping in a boilerplate file (a
translated panel that predates `--lang`, a swapped icon set), `--update` will
overwrite them. Read the `--check` output first on any project you haven't
looked at recently.

## Reference

- [ADAPTING.md](ADAPTING.md): other stacks, more sections, more than one
  previewable page, staying in preview while browsing the site, and what
  changes if the selection must go live for everyone.

## Keeping this skill current

Fixes found in real projects only help if they make their way back here. If a
project needs something this skill doesn't cover, or a bug turns up in one of
the eight files, fix it in that project first, then port the fix into
`templates/` and, if it applies generally, into this file or
[ADAPTING.md](ADAPTING.md). If the templates drift from what actually works in
projects, the next install starts with the old bug.
