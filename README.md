# sundae

A Claude Code skill (`variant-preview`) that adds a private, password-protected `/preview` route to a Next.js App Router project, with a floating panel for switching between design versions of each section.

## Why

When you redesign a site section by section, you end up with several versions of the same section: three heroes, two footers, an old and a new pricing table. Comparing them usually means editing an `import` and reloading. You can't hand that to a client, and old versions tend to disappear into git history.

The common fix is a feature flag or a CMS field. That makes the public page read a cookie or a request, which turns a static page dynamic just to serve the one version every visitor sees.

This skill rests on one constraint from Next.js:

> Reading a cookie opts a route out of static rendering.

So the public route never reads the cookie. It imports its shipped versions directly, as before. Only `/preview` reads the cookie, and only `/preview` becomes dynamic.

## What you get

- A `/preview` route that renders the real page, using a per-browser cookie to decide which version of each section to show.
- A floating panel that lists every versioned section. The active version is highlighted, and a small dot marks the version the public route ships.
- Password protection. The session is an HMAC cookie, and every auth check fails closed when the password is not set.
- A public page that stays static. Visitors never see the panel and never get a different version.
- **Copy selection**: copies the current combination as an instruction you can paste to Claude, for example `Ship this variant-preview selection: {"hero":"v3","footer":"v2"}`.
- **Copy link**: copies a URL with the combination as query params (`/preview?hero=v3&footer=v2`), so you can send a client a specific combination.
- **Reset to live**: shown when the selection differs from what ships. Clears the cookie and any query params.
- `[` and `]` keyboard shortcuts to step through the versions of the last section you clicked.
- Optional per-page filtering: tag a section with `page: "about"` and pass `page="about"` to the panel to show only the sections on that page.
- Panel and login copy in English or Turkish, chosen once at install time with `--lang`.
- An installer that never overwrites existing files by default, plus `--check` and `--update` for keeping an install in sync with the templates.

The panel is dark and compact on purpose, so it reads as a tool and not as part of the design you are judging.

## Requirements

- Next.js App Router, version 15 or newer. Next.js 16 works too (it renamed Middleware to Proxy; this skill uses neither).
- React 19 (the login screen uses `useActionState`). Next.js 15 and 16 ship with it.
- TypeScript, with the `@/*` path alias in `tsconfig.json`. The installer checks for it.
- Tailwind CSS. The panel and login screen are styled with Tailwind classes.
- Node.js 18.18 or newer for Next.js 15, 20.9 or newer for Next.js 16. The installer itself only uses Node built-ins.
- Optional: `motion` and `lucide-react`. The panel uses them for its open and close animation and its icons. Without them, replace the animation wrapper with a plain conditional render and swap the icons. See step 7 in [SKILL.md](SKILL.md).

For Remix, Astro, SvelteKit or a Vite SPA, see [ADAPTING.md](ADAPTING.md).

## Install

Clone the repo into your Claude Code skills directory. The folder must be named `variant-preview` to match the `name` field in `SKILL.md`:

```bash
git clone https://github.com/kierkegaard-source/sundae.git ~/.claude/skills/variant-preview
```

Claude Code picks up the skill on the next session.

## Usage

### Asking Claude

Open a Next.js project in Claude Code and describe the situation, for example:

- "We have two heroes and I want to compare them."
- "Set up a version panel for the hero and the footer."
- "I want to show the client three pricing options without touching the live site."

Claude reads `SKILL.md`, asks which sections have versions (and a short label and note for each), runs the installer, then does the project-specific work: extracting the page shell, pointing the public route at it, filling in the registry and the component map, and adding the password.

When you have picked a combination, click **Copy selection** in the panel and paste the result into Claude. It updates the public route's imports and `DEFAULT_SELECTION` to match.

### What the installer does

`scripts/sundae.mjs` copies the eight files in `templates/` into the project and replaces a few placeholders: the project slug and name, the area folder, the accent colors and the panel copy. It writes to `<root>/src/...` if the project has `src/app`, otherwise to `<root>/...`.

```bash
node ~/.claude/skills/variant-preview/scripts/sundae.mjs --project-root . --accent "#0f766e" --lang en
```

Before writing, it checks that the project has a `package.json` and a `tsconfig.json` with the `@/*` alias. It skips any file that already exists unless you pass `--force`.

| File | Kind | Purpose |
| --- | --- | --- |
| `lib/variants.ts` | project | Registry of sections and versions, `DEFAULT_SELECTION`, cookie and query param parsing |
| `lib/studio-auth.ts` | boilerplate | HMAC session that fails closed |
| `components/<area>/page-shell.tsx` | project | Section order; versioned sections come in as props |
| `components/<area>/variant-map.tsx` | project | Maps version ids to components; only `/preview` imports it |
| `app/preview/page.tsx` | project | The dynamic preview route: auth gate, then shell and panel |
| `app/preview/actions.ts` | boilerplate | Server Functions: `signIn`, `signOut`, `chooseVariant`, `resetToLive` |
| `components/studio/variant-panel.tsx` | boilerplate | The floating panel |
| `components/studio/studio-login.tsx` | boilerplate | The password screen |

Boilerplate files are fully derived from the template and the flags. Project files are meant to be edited by hand (Claude does this during install).

### Flags

| Flag | Default | Effect |
| --- | --- | --- |
| `--project-root <path>` | current directory | Project to install into |
| `--slug <slug>` | `name` in `package.json`, else `app` | Used in the cookie names and the HMAC message |
| `--name "<Display Name>"` | slug in title case | Shown on the login screen |
| `--area <folder>` | `home` | Folder for the shell and map: `components/<area>/` |
| `--accent <#hex>` | `#334155` | Background of the active version chip |
| `--accent-fg <#hex>` | `#FFFFFF` | Text color of the active version chip |
| `--lang <en\|tr>` | `en` | Language of the panel and login screen |
| `--force` | off | Overwrite files that already exist |
| `--dry-run` | off | Print what would be written without writing |
| `--skip-alias-check` | off | Skip the `@/*` check in `tsconfig.json` |
| `--check` | off | Read-only. Compare installed files with fresh renders and print `same`, `differs` or `missing` for each |
| `--update` | off | Rewrite only the four boilerplate files. Never touches the four project files |
| `--help` | off | Print the usage notes from the top of the script |

`--check` and `--update` can't be combined. When you run either on an existing install, pass the same `--accent`, `--accent-fg`, `--lang` and `--slug` you installed with, or every boilerplate file reports `differs`. `--update` warns before writing a different slug into `studio-auth.ts`, because that signs out every existing session.

## How it works

1. `variants.ts` lists every section and its versions. It is the only source of truth: cookie values and query params that name a section or version not in the registry are dropped.
2. `page-shell.tsx` holds the section order. Both the public route and `/preview` render it, so they can't drift apart.
3. The public route passes its shipped versions to the shell as direct imports. It never reads a cookie, so it stays static.
4. `/preview` checks the session, reads the variant cookie, applies any query params on top, and renders each versioned section through `variant-map.tsx`.
5. Clicking a chip calls the `chooseVariant` Server Function. It re-checks the session, validates the ids, writes the cookie, and the panel calls `router.refresh()`.
6. Shipping a version is a code change: update the import in the public route and `DEFAULT_SELECTION` in `variants.ts`. The panel can't publish anything.

After installing, run `next build` and check the route table: the public route should still show `○ (Static)` and only `/preview` should show `ƒ (Dynamic)`.

## Configuration

| Variable | Where | Purpose |
| --- | --- | --- |
| `STUDIO_PASSWORD` | `.env.local` locally, your host's environment settings in production | The preview password. If it is unset, sign-in is disabled and the login screen tells you to set it |
| `NODE_ENV` | set by Next.js | The session and variant cookies are marked `secure` when it is `production` |

Cookie names come from the slug: `<slug>_studio` (httpOnly session) and `<slug>_variants` (the selection, readable on purpose since it holds nothing secret).

Also add `disallow: "/preview"` to `app/robots.ts` if the project has one. The preview page already sets `robots: { index: false, follow: false }` in its metadata.

## Limitations

- One preview route covers one page. For more pages, add a route per page or a catch-all route. See [ADAPTING.md](ADAPTING.md).
- The selection lives in a cookie per browser. There is no shared state, so the panel can't change what other people see, and that is intended.
- Links copied from `localhost` only open on your machine. The button reads **Copy link (local)** in that case.
- The panel and login templates assume Tailwind, `motion` and `lucide-react`. Projects without them need small edits.
- If the root layout wraps everything in `<LazyMotion strict>`, the panel's `motion.*` components throw. Import `m as motion` instead (see step 7 in [SKILL.md](SKILL.md)).
- The installer parses `tsconfig.json` as plain JSON. A file with comments or trailing commas fails the alias check; use `--skip-alias-check` after confirming the alias exists.
- Old versions stay in the tree and still type-check, but nothing renders them. A change to a shared component can break one without any warning.

## Documentation

- [SKILL.md](SKILL.md): the instructions Claude follows, including the install steps, the rules the design depends on and how to ship a pasted selection.
- [ADAPTING.md](ADAPTING.md): multiple pages, staying in preview while browsing the site, other frameworks, and common pitfalls.

## License

[MIT](LICENSE)
