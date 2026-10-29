import type { Metadata } from "next";
import { cookies } from "next/headers";
import { PageShell } from "@/components/__AREA__/page-shell";
import { renderVariant } from "@/components/__AREA__/variant-map";
import { StudioLogin } from "@/components/studio/studio-login";
import { VariantPanel } from "@/components/studio/variant-panel";
import { isStudioAuthed, isStudioConfigured } from "@/lib/studio-auth";
import { VARIANT_COOKIE, applyParams, parseSelection } from "@/lib/variants";

export const metadata: Metadata = {
  title: "Version preview",
  robots: { index: false, follow: false },
};

/**
 * The page rendered from whatever the panel has selected.
 *
 * Kept off the public route on purpose: reading a cookie opts a route out of
 * static rendering, and only this route should pay for that. It is also why the
 * choice is per-browser: nothing here changes what a visitor sees.
 *
 * __PLACEHOLDER__: one `renderVariant` call per versioned section.
 */
export default async function Preview({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  if (!(await isStudioAuthed())) {
    return <StudioLogin configured={isStudioConfigured()} />;
  }

  // A link wins over the cookie and is never written back to it. Opening a
  // shared link must not silently overwrite whatever the browser had chosen.
  const cookieSelection = parseSelection((await cookies()).get(VARIANT_COOKIE)?.value);
  const { selection, fromLink } = applyParams(cookieSelection, await searchParams);

  return (
    <>
      <PageShell
        hero={renderVariant("hero", selection.hero)}
        footer={renderVariant("footer", selection.footer)}
      />
      {/* No <Suspense> around this: this route already force-dynamics via
          cookies() above, so useSearchParams (used for link-mode chip edits)
          doesn't need one to build. Wrapping it in one anyway has been
          observed to silently break client hydration of the whole panel (no
          console error, chips just stop responding to clicks). Confirmed by
          removing it and testing. */}
      <VariantPanel selection={selection} fromLink={fromLink} />
    </>
  );
}
