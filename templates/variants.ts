/**
 * The version registry: the single source of truth for what exists.
 *
 * No JSX: this is imported by server code, client code, and the panel alike.
 * The id -> component map lives in `variant-map.tsx`, which only the preview
 * route imports, so the public page still bundles the one version it renders
 * instead of all of them.
 *
 * __PLACEHOLDER__: replace SECTIONS and DEFAULT_SELECTION with this project's
 * sections. Labels are what the panel shows, so write them for a human ("Editorial",
 * not "v5"). Notes appear under the active choice and as the button's tooltip.
 * List them in page order, top to bottom. The panel renders SECTIONS in this
 * order verbatim, and a section that shows third in the panel but last on the
 * page reads as the panel being disorganized, not as an intentional choice.
 * A section shared across pages (no `page` field) should sit at the position
 * it holds on every page that uses it, if they agree; if they don't, pick
 * whichever page matters most for judging it.
 *
 * More than one previewable page (see ADAPTING.md)? Add an optional `page`
 * field to a section entry (e.g. `page: "about"`) and pass the matching
 * `page` prop to `<VariantPanel>` on that page's preview route. The panel
 * then only shows sections relevant to where you are, instead of chips that
 * do nothing because the page they'd affect isn't the one being rendered.
 * Sections with no `page` field always show, on every preview route.
 */

export const VARIANT_COOKIE = "__PROJECT_SLUG___variants";
export const STUDIO_COOKIE = "__PROJECT_SLUG___studio";

export const SECTIONS = [
  {
    id: "hero",
    label: "Hero",
    versions: [
      { id: "v1", label: "Globe", note: "Rotating globe with draggable cards." },
      { id: "v2", label: "Editorial", note: "No panel, open on the page." },
    ],
  },
  {
    id: "footer",
    label: "Footer",
    versions: [
      { id: "v1", label: "Stacked", note: "Single column, links stacked." },
      { id: "v2", label: "Framed", note: "Framed block matching the hero." },
    ],
  },
] as const;

type SectionEntry = (typeof SECTIONS)[number];
type VersionIdOf<S extends SectionId> =
  Extract<SectionEntry, { id: S }>["versions"][number]["id"];

export type SectionId = SectionEntry["id"];
// Each section's value is narrowed to its own registered version ids, not
// `string`, so a typo or a version deleted from SECTIONS is a type error at
// every call site (most importantly DEFAULT_SELECTION below) instead of a
// silent blank render discovered in front of a client.
export type Selection = { [S in SectionId]: VersionIdOf<S> };

/**
 * What visitors get. Changing these (and the imports in the public route) is
 * what ships a version for real. The panel deliberately cannot write here.
 */
export const DEFAULT_SELECTION: Selection = {
  hero: "v2",
  footer: "v2",
};

export function isSectionId(value: string): value is SectionId {
  return SECTIONS.some((s) => s.id === value);
}

export function hasVersion(section: SectionId, version: string): boolean {
  const entry = SECTIONS.find((s) => s.id === section);
  return entry ? entry.versions.some((v) => v.id === version) : false;
}

/** Cookie value -> a selection, dropping anything the registry does not list. */
export function parseSelection(raw: string | undefined): Selection {
  const selection: Selection = { ...DEFAULT_SELECTION };
  if (!raw) return selection;

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return selection;
  }
  if (typeof parsed !== "object" || parsed === null) return selection;

  for (const [key, value] of Object.entries(parsed as Record<string, unknown>)) {
    if (typeof value === "string" && isSectionId(key) && hasVersion(key, value)) {
      // hasVersion already proved `value` is a real version id for this
      // section; TypeScript can't see through that runtime check, so this
      // cast is the one honest escape hatch in the file.
      (selection as Record<SectionId, string>)[key] = value;
    }
  }
  return selection;
}

export function serializeSelection(selection: Selection): string {
  return JSON.stringify(selection);
}

/**
 * Query params -> a selection, dropping anything the registry does not list.
 * Same validation as `parseSelection`, same reason: a hand-edited URL must
 * never be able to name a component that doesn't exist.
 *
 * `base` is the cookie's selection; a param wins over it per key, so a link
 * can override just the sections it cares about and fall back to whatever
 * the browser already had selected for the rest. Nothing here writes the
 * cookie: a shared link must not silently overwrite what the person opening
 * it had chosen.
 */
export function applyParams(
  base: Selection,
  params: Record<string, string | string[] | undefined>
): { selection: Selection; fromLink: boolean } {
  const selection: Selection = { ...base };
  let fromLink = false;
  for (const [key, raw] of Object.entries(params)) {
    const value = Array.isArray(raw) ? raw[0] : raw;
    if (typeof value === "string" && isSectionId(key) && hasVersion(key, value)) {
      (selection as Record<SectionId, string>)[key] = value;
      fromLink = true;
    }
  }
  return { selection, fromLink };
}
