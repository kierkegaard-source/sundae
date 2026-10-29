#!/usr/bin/env node
// sundae: installs the variant-preview templates into a Next.js App Router
// project and substitutes the purely mechanical placeholders (project slug,
// project name, area folder, accent colors, panel copy). It never overwrites a
// file that already exists unless --force is passed, so re-running it after the
// project files (variants.ts, page-shell.tsx, variant-map.tsx,
// preview/page.tsx) have been hand-edited does not clobber that work.
//
// Usage:
//   node sundae.mjs [--project-root <path>] [--slug <slug>]
//     [--name "<Display Name>"] [--area <folder>] [--accent <#hex>]
//     [--accent-fg <#hex>] [--lang en|tr] [--force] [--dry-run]
//     [--skip-alias-check]
//   node sundae.mjs --check [--project-root <path>] [...]
//   node sundae.mjs --update [--project-root <path>] [...]
//
// All flags are optional. --slug/--name default to the "name" field in the
// project's package.json. --area defaults to "home". --accent defaults to a
// neutral slate, so no brand color gets baked in by accident. Files go to
// <root>/src/... if the project has src/app, otherwise to <root>/... (detected
// automatically). --lang picks the panel and login copy (default "en"); set it
// on purpose for a client-facing preview (see STRINGS below).
// --skip-alias-check skips the "@/*" tsconfig check (only needed for a repo
// that resolves that alias some other way, e.g. a custom webpack config).
//
// --check renders every template with this project's tokens, compares it with
// what's on disk and reports same/differs/missing per file. Read-only.
//
// --update rewrites only the four boilerplate files (studio-auth.ts,
// preview-actions.ts, variant-panel.tsx, studio-login.tsx). They are fully
// derived from template + tokens, so a template fix can reach an existing
// install. It never touches the four project files (variants.ts,
// page-shell.tsx, variant-map.tsx, preview-page.tsx), which are meant to be
// hand-edited. To pick up a template change in one of those, run a plain
// --force install and re-apply your edits.

// The panel and login screen's user-facing strings. Kept flat and total (both
// languages define every key) rather than a real i18n setup, because this is
// one flag chosen once at install time, not a runtime locale switch. Add a
// language by adding a key here, not a dependency.
const STRINGS = {
  en: {
    __T_HEADING__: "Versions",
    __T_HIDE__: "Hide the version panel",
    __T_SHOW__: "Show the version panel",
    __T_COPY_SELECTION__: "Copy selection",
    __T_COPIED__: "Copied",
    __T_COPY_LINK__: "Copy link",
    __T_COPY_LINK_LOCAL__: "Copy link (local)",
    __T_SHARED_LINK__: "Showing a shared link",
    __T_RESET__: "Reset",
    __T_LIVE__: "Live",
    __T_OFF_LIVE__: "Not showing what's live",
    __T_RESET_TO_LIVE__: "Reset to live",
    __T_SIGN_OUT__: "Sign out",
    __T_LOGIN_TITLE__: "Version preview",
    __T_LOGIN_TAGLINE__:
      "Switch between the versions of each section. What you pick is stored in this browser only. The live site is unaffected.",
    __T_PASSWORD__: "Password",
    __T_CHECKING__: "Checking...",
    __T_ENTER__: "Enter",
    __T_NOT_CONFIGURED_PRE__: "Set",
    __T_NOT_CONFIGURED_MID__:
      " in your environment to use this page. Locally that means a line in ",
    __T_NOT_CONFIGURED_POST__: "; on Vercel it is a project environment variable.",
    __T_ENTER_PASSWORD_ERROR__: "Enter a password.",
    __T_WRONG_PASSWORD_ERROR__: "Wrong password.",
  },
  tr: {
    __T_HEADING__: "Versiyonlar",
    __T_HIDE__: "Versiyon panelini gizle",
    __T_SHOW__: "Versiyon panelini göster",
    __T_COPY_SELECTION__: "Seçimi kopyala",
    __T_COPIED__: "Kopyalandı",
    __T_COPY_LINK__: "Bağlantıyı kopyala",
    __T_COPY_LINK_LOCAL__: "Bağlantıyı kopyala (yerel)",
    __T_SHARED_LINK__: "Paylaşılan bir bağlantı gösteriliyor",
    __T_RESET__: "Sıfırla",
    __T_LIVE__: "Yayında",
    __T_OFF_LIVE__: "Yayındaki hâliyle aynı değil",
    __T_RESET_TO_LIVE__: "Yayındakine dön",
    __T_SIGN_OUT__: "Çıkış yap",
    __T_LOGIN_TITLE__: "Versiyon önizleme",
    __T_LOGIN_TAGLINE__:
      "Bölümlerin farklı versiyonları arasında geçiş yapın. Seçiminiz yalnızca bu tarayıcıda saklanır, canlı site etkilenmez.",
    __T_PASSWORD__: "Şifre",
    __T_CHECKING__: "Kontrol ediliyor...",
    __T_ENTER__: "Giriş yap",
    __T_NOT_CONFIGURED_PRE__: "Bu sayfayı kullanmak için ortam değişkenlerine",
    __T_NOT_CONFIGURED_MID__: " ekleyin. Lokalde bu, ",
    __T_NOT_CONFIGURED_POST__:
      " dosyasında bir satır demek; Vercel'de proje ortam değişkenidir.",
    __T_ENTER_PASSWORD_ERROR__: "Şifre girin.",
    __T_WRONG_PASSWORD_ERROR__: "Şifre yanlış.",
  },
};

import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const TEMPLATES_DIR = join(SCRIPT_DIR, "..", "templates");

function parseArgs(argv) {
  const args = { area: "home", accent: "#334155", accentFg: "#FFFFFF" };
  for (let i = 0; i < argv.length; i++) {
    const flag = argv[i];
    const next = () => argv[++i];
    switch (flag) {
      case "--project-root": args.projectRoot = next(); break;
      case "--slug": args.slug = next(); break;
      case "--name": args.name = next(); break;
      case "--area": args.area = next(); break;
      case "--accent": args.accent = next(); break;
      case "--accent-fg": args.accentFg = next(); break;
      case "--lang": args.lang = next(); break;
      case "--force": args.force = true; break;
      case "--dry-run": args.dryRun = true; break;
      case "--skip-alias-check": args.skipAliasCheck = true; break;
      case "--check": args.check = true; break;
      case "--update": args.update = true; break;
      case "--help": args.help = true; break;
      default:
        console.error(`Unknown flag: ${flag}`);
        process.exit(1);
    }
  }
  return args;
}

function titleCase(slug) {
  return slug
    .split(/[-_]/)
    .filter(Boolean)
    .map((w) => w[0].toUpperCase() + w.slice(1))
    .join(" ");
}

function readPackageName(projectRoot) {
  const pkgPath = join(projectRoot, "package.json");
  if (!existsSync(pkgPath)) return null;
  try {
    const pkg = JSON.parse(readFileSync(pkgPath, "utf8"));
    return typeof pkg.name === "string" ? pkg.name : null;
  } catch {
    return null;
  }
}

// Next.js reads either <root>/src/app or <root>/app. Follow whichever the
// project already has. Installing into the other one type-checks fine but the
// route never renders, which is a much worse failure than a missing directory.
function sourceRoot(projectRoot) {
  if (existsSync(join(projectRoot, "src", "app"))) return join(projectRoot, "src");
  if (existsSync(join(projectRoot, "app"))) return projectRoot;
  return join(projectRoot, "src"); // greenfield: match create-next-app's default
}

// Every template imports via `@/...`. If the project's tsconfig does not
// resolve that alias, every one of the eight files fails to compile the
// moment it lands, so fail before writing anything instead of after.
function checkPathAlias(projectRoot) {
  const tsconfigPath = join(projectRoot, "tsconfig.json");
  if (!existsSync(tsconfigPath)) {
    console.error(`No tsconfig.json at ${projectRoot}. This skill assumes TypeScript.`);
    process.exit(1);
  }
  let tsconfig;
  try {
    // tsconfig.json commonly has comments/trailing commas; a strict JSON.parse
    // is good enough here since we only need to check one key, not build.
    tsconfig = JSON.parse(readFileSync(tsconfigPath, "utf8"));
  } catch {
    console.error(`Could not parse ${tsconfigPath}. Fix it or pass --skip-alias-check.`);
    process.exit(1);
  }
  const paths = tsconfig.compilerOptions?.paths ?? {};
  const hasAlias = Object.keys(paths).some((k) => k === "@/*");
  if (!hasAlias) {
    console.error(
      `${tsconfigPath} has no "@/*" path alias in compilerOptions.paths.\n` +
        `Every template imports via @/..., so add the alias first, e.g.:\n` +
        `  "paths": { "@/*": ["./src/*"] }  (or ["./*"] for a project with no src/)`
    );
    process.exit(1);
  }
}

function substitute(content, tokens) {
  let out = content;
  for (const [key, value] of Object.entries(tokens)) {
    out = out.split(key).join(value);
  }
  return out;
}

// destination is relative to SRC (src/ if the project has one, else the root).
// "kind" is the boilerplate/project split --check and --update act on:
// boilerplate is byte-for-byte derivable from template + tokens; project is
// meant to be hand-edited and --update must never touch it.
function fileList(area) {
  return [
    ["variants.ts", "lib/variants.ts", "project"],
    ["studio-auth.ts", "lib/studio-auth.ts", "boilerplate"],
    ["page-shell.tsx", `components/${area}/page-shell.tsx`, "project"],
    ["variant-map.tsx", `components/${area}/variant-map.tsx`, "project"],
    ["preview-page.tsx", "app/preview/page.tsx", "project"],
    ["preview-actions.ts", "app/preview/actions.ts", "boilerplate"],
    ["variant-panel.tsx", "components/studio/variant-panel.tsx", "boilerplate"],
    ["studio-login.tsx", "components/studio/studio-login.tsx", "boilerplate"],
  ];
}

// Shared setup for all three commands (install/--check/--update): validate
// the project, resolve where files go, and build the substitution tokens.
function resolveContext(args) {
  const projectRoot = resolve(args.projectRoot || process.cwd());
  if (!existsSync(join(projectRoot, "package.json"))) {
    console.error(
      `No package.json at ${projectRoot}. Pass --project-root, or run this from the project itself.`
    );
    process.exit(1);
  }

  if (!args.skipAliasCheck) checkPathAlias(projectRoot);
  const SRC = sourceRoot(projectRoot);
  const srcLabel = relative(projectRoot, SRC) || "."; // "src" or "." for a flat app/

  const slug = args.slug || readPackageName(projectRoot) || "app";
  const name = args.name || titleCase(slug);
  const area = args.area;
  const lang = args.lang || "en";
  if (!STRINGS[lang]) {
    console.error(`Unknown --lang "${lang}". Supported: ${Object.keys(STRINGS).join(", ")}`);
    process.exit(1);
  }

  const tokens = {
    __PROJECT_SLUG__: slug,
    __PROJECT_NAME__: name,
    __AREA__: area,
    __ACCENT_BG__: args.accent,
    __ACCENT_FG__: args.accentFg,
    ...STRINGS[lang],
  };

  return { projectRoot, SRC, srcLabel, slug, name, area, lang, tokens, FILES: fileList(area) };
}

function runInstall(ctx, args) {
  const { SRC, srcLabel, name, slug, area, lang, tokens, FILES } = ctx;

  console.log(`Project: ${name} (slug: ${slug}, area: ${area}, lang: ${lang})`);
  console.log(`Source root: ${srcLabel}/`);
  console.log(args.dryRun ? "Dry run: no files will be written.\n" : "");

  let written = 0;
  let skipped = 0;

  for (const [templateName, relDest] of FILES) {
    const srcPath = join(TEMPLATES_DIR, templateName);
    const destPath = join(SRC, relDest);
    const label = `${srcLabel}/${relDest}`;

    if (existsSync(destPath) && !args.force) {
      console.log(`  skip (exists)  ${label}`);
      skipped++;
      continue;
    }

    const content = substitute(readFileSync(srcPath, "utf8"), tokens);

    if (args.dryRun) {
      console.log(`  would write    ${label}`);
      written++;
      continue;
    }

    mkdirSync(dirname(destPath), { recursive: true });
    writeFileSync(destPath, content, "utf8");
    console.log(`  wrote          ${label}`);
    written++;
  }

  console.log(`\n${written} written, ${skipped} skipped (already existed).`);
  console.log(`
Still to do by hand (the script only knows the boilerplate, not the project):
  1. ${srcLabel}/lib/variants.ts
     Replace the example SECTIONS/DEFAULT_SELECTION with this project's real
     sections and versions.
  2. ${srcLabel}/components/${area}/page-shell.tsx
     Replace the example imports with the project's actual always-on sections,
     in real page order.
  3. ${srcLabel}/components/${area}/variant-map.tsx
     Import every real version component. This is the only file allowed to
     import all of them.
  4. ${srcLabel}/app/page.tsx (the public route)
     Render PageShell with the shipped versions as direct imports, per
     SKILL.md step 4.
  5. .env.local
     Set STUDIO_PASSWORD (gitignored). Also set it in the deploy host's
     environment settings.
  6. ${srcLabel}/app/robots.ts
     Add disallow: "/preview" if a robots route already exists.
  7. Check for "motion" and "lucide-react" in package.json. variant-panel.tsx
     uses Motion for the panel's open/close animation and lucide-react for its
     icons. Neither is required: drop the AnimatePresence/motion wrapper for
     plain conditional rendering, and swap the icons for inline SVGs or any
     icon set already in the project.
`);
}

function runCheck(ctx) {
  const { SRC, srcLabel, name, slug, area, lang, tokens, FILES } = ctx;

  console.log(`Project: ${name} (slug: ${slug}, area: ${area}, lang: ${lang})`);
  console.log(`Source root: ${srcLabel}/`);
  console.log("Comparing installed files to what this project's tokens would render.\n");

  const counts = { same: 0, differs: 0, missing: 0 };

  for (const [templateName, relDest, kind] of FILES) {
    const srcPath = join(TEMPLATES_DIR, templateName);
    const destPath = join(SRC, relDest);
    const label = `${srcLabel}/${relDest}`;
    const rendered = substitute(readFileSync(srcPath, "utf8"), tokens);

    if (!existsSync(destPath)) {
      // page-shell.tsx especially: the file may simply have been renamed
      // (e.g. home-page.tsx) rather than actually missing. That's fine:
      // it's a project file and --update never touches it either way.
      const note =
        relDest.endsWith("page-shell.tsx")
          ? "  (fine if the shell was renamed, it's a project file)"
          : "";
      console.log(`  missing        [${kind}]  ${label}${note}`);
      counts.missing++;
      continue;
    }

    const onDisk = readFileSync(destPath, "utf8");
    if (onDisk === rendered) {
      console.log(`  same           [${kind}]  ${label}`);
      counts.same++;
    } else {
      console.log(`  differs        [${kind}]  ${label}`);
      counts.differs++;
    }
  }

  console.log(`\n${counts.same} same, ${counts.differs} differ, ${counts.missing} missing.`);
  if (counts.differs > 0) {
    console.log(
      `Run with --update to refresh the boilerplate files that differ (studio-auth.ts, ` +
        `preview-actions.ts, variant-panel.tsx, studio-login.tsx). Project files ` +
        `(variants.ts, page-shell.tsx, variant-map.tsx, preview-page.tsx) are never ` +
        `touched by --update. Re-apply their edits by hand after a plain --force install.`
    );
  }
}

// Reads the slug embedded in an already-installed studio-auth.ts's
// TOKEN_MESSAGE, so --update can warn before silently invalidating every
// existing session by writing a different one.
function readInstalledSlug(destPath) {
  if (!existsSync(destPath)) return null;
  const match = readFileSync(destPath, "utf8").match(/TOKEN_MESSAGE = "(.+)-studio-v1"/);
  return match ? match[1] : null;
}

function runUpdate(ctx, args) {
  const { SRC, srcLabel, name, slug, area, lang, tokens, FILES } = ctx;
  const boilerplate = FILES.filter(([, , kind]) => kind === "boilerplate");
  const project = FILES.filter(([, , kind]) => kind === "project");

  console.log(`Project: ${name} (slug: ${slug}, area: ${area}, lang: ${lang})`);
  console.log(`Source root: ${srcLabel}/`);
  console.log(args.dryRun ? "Dry run: no files will be written.\n" : "");

  const installedSlug = readInstalledSlug(join(SRC, "lib/studio-auth.ts"));
  if (installedSlug && installedSlug !== slug) {
    console.log(
      `WARNING: installed studio-auth.ts uses slug "${installedSlug}", this run resolved ` +
        `"${slug}". Writing with the new slug invalidates every existing signed-in session ` +
        `(the cookie is an HMAC keyed partly by this string). Pass --slug "${installedSlug}" ` +
        `to keep sessions valid, or proceed if that's intended.\n`
    );
  }

  let written = 0;

  for (const [templateName, relDest] of boilerplate) {
    const srcPath = join(TEMPLATES_DIR, templateName);
    const destPath = join(SRC, relDest);
    const label = `${srcLabel}/${relDest}`;
    const content = substitute(readFileSync(srcPath, "utf8"), tokens);

    if (args.dryRun) {
      console.log(`  would write    ${label}`);
      written++;
      continue;
    }

    mkdirSync(dirname(destPath), { recursive: true });
    writeFileSync(destPath, content, "utf8");
    console.log(`  wrote          ${label}`);
    written++;
  }

  console.log(`\n${written} boilerplate file(s) updated. Project files left untouched:`);
  for (const [, relDest] of project) {
    console.log(`  ${srcLabel}/${relDest}`);
  }
  console.log(`\nBuild and check the route table after this (SKILL.md step 8). A template`);
  console.log(`change that shifts what a project file needs to pass (a new prop, a new`);
  console.log(`export) will show up as a type error there, not here.`);
}

function main() {
  const args = parseArgs(process.argv.slice(2));

  if (args.help) {
    console.log(readFileSync(fileURLToPath(import.meta.url), "utf8").split("\n").slice(1, 30).join("\n"));
    return;
  }
  if (args.check && args.update) {
    console.error("Pass either --check or --update, not both.");
    process.exit(1);
  }

  const ctx = resolveContext(args);
  if (args.check) runCheck(ctx);
  else if (args.update) runUpdate(ctx, args);
  else runInstall(ctx, args);
}

main();
