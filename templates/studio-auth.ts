import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { STUDIO_COOKIE } from "./variants";

const TOKEN_MESSAGE = "__PROJECT_SLUG__-studio-v1";

/**
 * The session cookie is an HMAC of a fixed message keyed by the password, so
 * the password itself never leaves the server and the cookie cannot be forged
 * without it. If `STUDIO_PASSWORD` is unset every check fails closed rather
 * than letting an empty password through.
 */
function expectedToken(): string | null {
  const password = process.env.STUDIO_PASSWORD;
  if (!password) return null;
  return createHmac("sha256", password).update(TOKEN_MESSAGE).digest("base64url");
}

/** Fixed-length digests so the comparison cannot leak length by timing. */
function constantTimeEquals(a: string, b: string): boolean {
  const digest = (value: string) =>
    createHmac("sha256", TOKEN_MESSAGE).update(value).digest();
  return timingSafeEqual(digest(a), digest(b));
}

export function issueToken(candidatePassword: string): string | null {
  const password = process.env.STUDIO_PASSWORD;
  if (!password) return null;
  if (!constantTimeEquals(candidatePassword, password)) return null;
  return expectedToken();
}

export function isStudioConfigured(): boolean {
  return Boolean(process.env.STUDIO_PASSWORD);
}

export async function isStudioAuthed(): Promise<boolean> {
  const expected = expectedToken();
  if (!expected) return false;
  const presented = (await cookies()).get(STUDIO_COOKIE)?.value;
  if (!presented) return false;
  return constantTimeEquals(presented, expected);
}
