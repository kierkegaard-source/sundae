"use client";

import { useEffect, useState, useSyncExternalStore, useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Geist } from "next/font/google";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { Check, Copy, Layers, Link2, X } from "lucide-react";
import { DEFAULT_SELECTION, SECTIONS, type SectionId, type Selection } from "@/lib/variants";
import { chooseVariant, resetToLive, signOut } from "@/app/preview/actions";

// The active chip's colors. sundae.mjs fills these in from
// --accent/--accent-fg; left as neutral defaults if the flag was skipped.
const ACCENT_BG = "__ACCENT_BG__";
const ACCENT_FG = "__ACCENT_FG__";

// Set deliberately, not inherited from the site: the panel stays legible and
// consistent across every project regardless of whatever typeface is being
// judged. Self-hosted by Next.js at build time, so no extra dependency.
const geist = Geist({ subsets: ["latin"] });

// Panel chrome, kept apart from the logic so this file can be refreshed from
// the skill's templates (see SKILL.md's --update) without clobbering a
// translated install. sundae.mjs fills these from --lang.
const COPY = {
  heading: "__T_HEADING__",
  hide: "__T_HIDE__",
  show: "__T_SHOW__",
  copySelection: "__T_COPY_SELECTION__",
  copied: "__T_COPIED__",
  copyLink: "__T_COPY_LINK__",
  copyLinkLocal: "__T_COPY_LINK_LOCAL__",
  sharedLink: "__T_SHARED_LINK__",
  reset: "__T_RESET__",
  live: "__T_LIVE__",
  offLive: "__T_OFF_LIVE__",
  resetToLive: "__T_RESET_TO_LIVE__",
  signOut: "__T_SIGN_OUT__",
};

/**
 * Deliberately not styled like the site. This is a tool sitting on top of the
 * page being judged, so it stays dark, compact, and visually foreign. If it
 * borrowed the site's own surfaces it would start reading as part of the design
 * under review.
 *
 * If the project has no Motion/lucide, drop the animation and swap the icons;
 * nothing else here depends on them.
 */
export function VariantPanel({
  selection,
  fromLink = false,
  page,
}: {
  selection: Selection;
  /** True when this render came from query params overriding the cookie
   * (see preview-page.tsx). While true, chips edit the URL instead of the
   * cookie, since the URL would otherwise keep overruling every click. */
  fromLink?: boolean;
  /** Which preview route this is ("about", "pricing", ...) when the project
   * has more than one (see ADAPTING.md, "More than one previewable page").
   * Sections tagged with a different `page` are hidden, so the panel never
   * shows a chip that does nothing because the section it affects isn't on
   * this page. Sections with no `page` field always show. Omit entirely for
   * a single-page project. */
  page?: string;
}) {
  const [open, setOpen] = useState(true);
  const [pending, startTransition] = useTransition();
  const [copiedSelection, setCopiedSelection] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  // useSyncExternalStore, not useState + effect: projects running the React
  // Compiler lint preset reject synchronous setState inside an effect body
  // (react-hooks/set-state-in-effect), and this is the SSR-safe idiom anyway:
  // false on the server, the real answer on the client, no subscription
  // because the hostname never changes within a page's lifetime.
  const isLocalhost = useSyncExternalStore(
    () => () => {},
    () => window.location.hostname === "localhost",
    () => false
  );
  // Which section [ and ] cycle through: the one whose chip was clicked
  // last, defaulting to the first. A single cursor is enough for the usual
  // handful of sections, so there is no separate focus UI.
  const [cursor, setCursor] = useState(0);
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const shouldReduceMotion = useReducedMotion();

  // Sections aren't guaranteed to declare `page` (most single-page projects
  // never will), so this reads it structurally rather than assuming the type
  // has it.
  const visibleSections = page
    ? SECTIONS.filter((s) => {
        const sectionPage = (s as { page?: string }).page;
        return !sectionPage || sectionPage === page;
      })
    : SECTIONS;

  // Whether anything currently visible has drifted from what's actually
  // shipped. Drives whether "Reset to live" shows at all, so it's not one
  // more permanent button competing for attention when everything already
  // matches production.
  const offLive = visibleSections.some(
    (s) => selection[s.id] !== DEFAULT_SELECTION[s.id]
  );

  // [ and ] flip the cursored section to its previous/next version, so
  // comparing designs doesn't mean a trip to this corner on every flip.
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.metaKey || event.ctrlKey || event.altKey) return;
      if (event.key !== "[" && event.key !== "]") return;
      const target = event.target as HTMLElement | null;
      if (
        target?.isContentEditable ||
        target?.tagName === "INPUT" ||
        target?.tagName === "TEXTAREA" ||
        target?.tagName === "SELECT"
      ) {
        return;
      }
      const section = visibleSections[cursor];
      if (!section) return;
      // `section` is visibleSections[cursor] with cursor: number, so
      // TypeScript sees the union of every section's id type rather than
      // narrowing to this one. Widen to string so indexOf's argument (a
      // Selection value, itself widened the same way once indexed by a
      // non-literal key) lines up. Runtime-safe: both sides come from the
      // same section.
      const ids: string[] = section.versions.map((v) => v.id);
      const current = ids.indexOf(selection[section.id]);
      const delta = event.key === "]" ? 1 : -1;
      const next = ids[(current + delta + ids.length) % ids.length];
      choose(section.id, next);
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cursor, selection, fromLink, searchParams, visibleSections]);

  function choose(section: SectionId, version: string) {
    setCursor(visibleSections.findIndex((s) => s.id === section));
    if (fromLink) {
      // A link is driving this page. Writing the cookie here would change
      // nothing visible, because the URL always wins. So edit the URL
      // instead. This also lets you build a link live: click chips, then copy
      // the address bar.
      const next = new URLSearchParams(searchParams.toString());
      next.set(section, version);
      router.replace(`${pathname}?${next.toString()}`, { scroll: false });
      return;
    }
    startTransition(async () => {
      await chooseVariant(section, version);
      // The action writes the cookie; the page has to be re-fetched to read it.
      router.refresh();
    });
  }

  // Pure client-side read of the `selection` prop already on the page: no
  // Server Function, no auth re-check needed, nothing gets written anywhere.
  //
  // Copies a ready-to-paste instruction, not bare JSON: naming the skill and
  // the action means Claude does not need this chat's history to know what to
  // do with it, and works the same whether one section changed or five did.
  function copySelection() {
    const text = `Ship this variant-preview selection: ${JSON.stringify(selection)}`;
    navigator.clipboard.writeText(text).then(() => {
      setCopiedSelection(true);
      setTimeout(() => setCopiedSelection(false), 1500);
    });
  }

  // A URL is already a snapshot, so no named-preset storage is needed. Every
  // section is written out, not just whatever's overridden today, so the
  // link is a complete, self-sufficient combination on its own.
  function copyLink() {
    const url = new URL(window.location.href);
    url.search = new URLSearchParams(selection as Record<string, string>).toString();
    navigator.clipboard.writeText(url.toString()).then(() => {
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 1500);
    });
  }

  function resetToCookie() {
    router.replace(pathname, { scroll: false });
  }

  // Unlike resetToCookie (which only matters in link mode, and only goes
  // back to whatever the cookie already had), this clears the cookie itself
  // and drops any query params. It is the one button that always lands back on
  // exactly what's shipped, regardless of how the current selection was
  // reached.
  function resetToLiveDefaults() {
    startTransition(async () => {
      await resetToLive();
      if (fromLink) {
        router.replace(pathname, { scroll: false });
      } else {
        router.refresh();
      }
    });
  }

  return (
    <div className={`${geist.className} fixed bottom-4 right-4 z-[100] print:hidden`}>
      <AnimatePresence initial={false} mode="wait">
        {open ? (
          <motion.div
            key="panel"
            initial={shouldReduceMotion ? false : { opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={shouldReduceMotion ? undefined : { opacity: 0, y: 12 }}
            transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
            className="w-[264px] overflow-hidden rounded-2xl bg-zinc-950/95 text-white shadow-[0_24px_60px_-20px_rgba(0,0,0,0.7)] ring-1 ring-white/10 backdrop-blur"
          >
            <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
              <span className="text-[11px] uppercase tracking-[0.2em] text-white/50">
                {COPY.heading}
              </span>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label={COPY.hide}
                className="-mr-1 rounded-full p-1 text-white/50 transition-colors hover:bg-white/10 hover:text-white"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>

            <div
              className={`px-4 py-3 transition-opacity ${
                pending ? "opacity-50" : "opacity-100"
              }`}
            >
              {visibleSections.map((section, i) => (
                <div key={section.id} className="py-2">
                  <span className="text-[12px] font-medium text-white/90">
                    {section.label}
                    {cursor === i ? (
                      <span aria-hidden className="ml-1.5 text-white/30">[ ]</span>
                    ) : null}
                  </span>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {section.versions.map((version) => {
                      const active = selection[section.id] === version.id;
                      const live = DEFAULT_SELECTION[section.id] === version.id;
                      return (
                        <button
                          key={version.id}
                          type="button"
                          title={live ? `${version.note} · ${COPY.live}` : version.note}
                          aria-pressed={active}
                          disabled={pending}
                          onClick={() => choose(section.id, version.id)}
                          className={`rounded-full px-2.5 py-1 text-[11px] font-medium transition-colors ${
                            active
                              ? ""
                              : "bg-white/10 text-white/70 hover:bg-white/20 hover:text-white"
                          }`}
                          style={
                            active
                              ? { backgroundColor: ACCENT_BG, color: ACCENT_FG }
                              : undefined
                          }
                        >
                          {version.label}
                          {live ? (
                            <span
                              aria-hidden
                              className="ml-1.5 inline-block h-1 w-1 rounded-full bg-current opacity-50"
                            />
                          ) : null}
                        </button>
                      );
                    })}
                  </div>
                  <p className="mt-2 text-[11px] leading-snug text-white/40">
                    {
                      section.versions.find((v) => v.id === selection[section.id])
                        ?.note
                    }
                  </p>
                </div>
              ))}
            </div>

            {offLive ? (
              <div className="flex flex-wrap items-center justify-between gap-x-2 gap-y-1 border-t border-white/10 px-4 py-2.5 text-[11px] text-white/40">
                <span className="min-w-0 flex-1">{COPY.offLive}</span>
                <button
                  type="button"
                  onClick={resetToLiveDefaults}
                  disabled={pending}
                  className="shrink-0 text-white/60 underline decoration-white/20 underline-offset-2 transition-colors hover:text-white disabled:opacity-50"
                >
                  {COPY.resetToLive}
                </button>
              </div>
            ) : null}

            {fromLink ? (
              <div className="flex flex-wrap items-center justify-between gap-x-2 gap-y-1 border-t border-white/10 px-4 py-2.5 text-[11px] text-white/40">
                <span className="min-w-0 flex-1">{COPY.sharedLink}</span>
                <button
                  type="button"
                  onClick={resetToCookie}
                  className="shrink-0 text-white/60 underline decoration-white/20 underline-offset-2 transition-colors hover:text-white"
                >
                  {COPY.reset}
                </button>
              </div>
            ) : null}

            {/* Two exits: one to whoever should see the combination (a
                client, over email), one to Claude (to ship it in code).
                Stacked, not side by side: a shared row assumes both labels
                fit at once, which breaks under longer copy (Turkish runs
                noticeably longer than English here) by wrapping mid-label
                and splitting the icon from its text. Each button gets the
                panel's full width instead, so only the longest single label
                has to fit. */}
            <div className="flex flex-col gap-2 border-t border-white/10 px-4 py-2.5">
              <button
                type="button"
                onClick={copySelection}
                className="flex items-center gap-1.5 text-[11px] text-white/60 transition-colors hover:text-white"
              >
                {copiedSelection ? (
                  <Check className="h-3 w-3 shrink-0" />
                ) : (
                  <Copy className="h-3 w-3 shrink-0" />
                )}
                <span className="truncate">
                  {copiedSelection ? COPY.copied : COPY.copySelection}
                </span>
              </button>
              <button
                type="button"
                onClick={copyLink}
                className="flex items-center gap-1.5 text-[11px] text-white/60 transition-colors hover:text-white"
              >
                {copiedLink ? (
                  <Check className="h-3 w-3 shrink-0" />
                ) : (
                  <Link2 className="h-3 w-3 shrink-0" />
                )}
                <span className="truncate">
                  {copiedLink ? COPY.copied : isLocalhost ? COPY.copyLinkLocal : COPY.copyLink}
                </span>
              </button>
            </div>

            <div className="flex flex-wrap items-center justify-end gap-x-3 gap-y-1 border-t border-white/10 px-4 py-2.5 text-[11px] text-white/40">
              <form action={signOut}>
                <button
                  type="submit"
                  className="transition-colors hover:text-white/80"
                >
                  {COPY.signOut}
                </button>
              </form>
            </div>
          </motion.div>
        ) : (
          <motion.button
            key="fab"
            type="button"
            onClick={() => setOpen(true)}
            initial={shouldReduceMotion ? false : { opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={shouldReduceMotion ? undefined : { opacity: 0, scale: 0.9 }}
            transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
            aria-label={COPY.show}
            className="flex h-11 w-11 items-center justify-center rounded-full bg-zinc-950/95 text-white shadow-[0_16px_40px_-16px_rgba(0,0,0,0.7)] ring-1 ring-white/10 backdrop-blur"
          >
            <Layers className="h-4 w-4" />
          </motion.button>
        )}
      </AnimatePresence>
    </div>
  );
}
