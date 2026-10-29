"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { issueToken, isStudioAuthed } from "@/lib/studio-auth";
import {
  STUDIO_COOKIE,
  VARIANT_COOKIE,
  hasVersion,
  isSectionId,
  parseSelection,
  serializeSelection,
  type SectionId,
} from "@/lib/variants";

const YEAR = 60 * 60 * 24 * 365;

// Filled from --lang, same as the COPY blocks in variant-panel.tsx and
// studio-login.tsx. Kept apart from the logic so --update can refresh this
// file without reverting a translated install's error copy.
const ENTER_PASSWORD_ERROR = "__T_ENTER_PASSWORD_ERROR__";
const WRONG_PASSWORD_ERROR = "__T_WRONG_PASSWORD_ERROR__";

export async function signIn(
  _previous: string | null,
  formData: FormData
): Promise<string | null> {
  const password = formData.get("password");
  if (typeof password !== "string") return ENTER_PASSWORD_ERROR;

  const token = issueToken(password);
  if (!token) return WRONG_PASSWORD_ERROR;

  (await cookies()).set(STUDIO_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: YEAR,
  });
  revalidatePath("/preview");
  return null;
}

export async function signOut(): Promise<void> {
  (await cookies()).delete(STUDIO_COOKIE);
  revalidatePath("/preview");
}

/**
 * Drops every override back to DEFAULT_SELECTION by deleting the variant
 * cookie outright, rather than writing DEFAULT_SELECTION's values into it.
 * An empty cookie and a cookie that happens to match the defaults must
 * behave identically, and only one of those needs maintaining.
 */
export async function resetToLive(): Promise<void> {
  if (!(await isStudioAuthed())) return;
  (await cookies()).delete(VARIANT_COOKIE);
  revalidatePath("/preview");
}

/**
 * Writes one section's choice.
 *
 * Two checks, both load-bearing. The session is re-checked because a Server
 * Function is a real endpoint anyone can call, not a UI event. Checking auth in
 * the page that renders the panel does not protect this. The ids are validated
 * against the registry so the cookie can only ever name a version that exists.
 *
 * Not httpOnly: nothing here is a secret, and leaving it readable makes the
 * selection easy to inspect while debugging.
 */
export async function chooseVariant(
  section: string,
  version: string
): Promise<void> {
  if (!(await isStudioAuthed())) return;
  if (!isSectionId(section) || !hasVersion(section, version)) return;

  const store = await cookies();
  const selection = parseSelection(store.get(VARIANT_COOKIE)?.value);
  // isSectionId/hasVersion above already proved this pair is real; same
  // honest cast as parseSelection's assignment in variants.ts.
  (selection as Record<SectionId, string>)[section] = version;

  store.set(VARIANT_COOKIE, serializeSelection(selection), {
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: YEAR,
  });
  revalidatePath("/preview");
}
