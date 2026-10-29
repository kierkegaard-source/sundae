import type { ReactNode } from "react";
import { DEFAULT_SELECTION, type Selection } from "@/lib/variants";

// __PLACEHOLDER__: import EVERY version here, including the ones the public
// route ships. This is the only file that imports all of them.
import { HeroV1 } from "@/components/home/hero-v1";
import { HeroV2 } from "@/components/home/hero-v2";
import { FooterV1 } from "@/components/layout/footer-v1";
import { FooterV2 } from "@/components/layout/footer-v2";

/**
 * Every version, imported for real.
 *
 * ONLY the preview route may import this file. Importing it from the public
 * route would pull all four heroes into the bundle a visitor downloads, which
 * defeats the reason the two routes are separate.
 *
 * Thunks rather than elements: a bare element would be constructed on every
 * render of this module regardless of which one is selected.
 */
const MAP: Record<string, Record<string, () => ReactNode>> = {
  hero: {
    v1: () => <HeroV1 />,
    v2: () => <HeroV2 />,
  },
  footer: {
    v1: () => <FooterV1 />,
    v2: () => <FooterV2 />,
  },
};

export function renderVariant(section: keyof Selection, version: string) {
  const render =
    MAP[section]?.[version] ?? MAP[section]?.[DEFAULT_SELECTION[section]];
  if (!render && process.env.NODE_ENV !== "production") {
    // Both the requested version and the registry's own default are missing
    // from this map, so the section is about to render as nothing, silently.
    // This happens when a version is deleted from disk/variants.ts but this
    // file (the only place components are imported for real) isn't updated
    // to match, or DEFAULT_SELECTION still names a version that's gone.
    console.warn(
      `variant-preview: no component for ${String(section)}.${version} and none ` +
        `for the default (${DEFAULT_SELECTION[section]}). This section will ` +
        `render blank. Add it to variant-map.tsx.`
    );
  }
  return render ? render() : null;
}
