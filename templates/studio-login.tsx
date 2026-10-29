"use client";

import { useActionState } from "react";
import { signIn } from "@/app/preview/actions";

// Kept apart from the JSX for the same reason as variant-panel.tsx's COPY,
// so this file can be refreshed from the skill's templates (--update)
// without clobbering a translated install. Filled from --lang.
const COPY = {
  title: "__T_LOGIN_TITLE__",
  tagline: "__T_LOGIN_TAGLINE__",
  password: "__T_PASSWORD__",
  checking: "__T_CHECKING__",
  enter: "__T_ENTER__",
  notConfiguredPre: "__T_NOT_CONFIGURED_PRE__",
  notConfiguredMid: "__T_NOT_CONFIGURED_MID__",
  notConfiguredPost: "__T_NOT_CONFIGURED_POST__",
};

export function StudioLogin({ configured }: { configured: boolean }) {
  const [error, formAction, pending] = useActionState<string | null, FormData>(
    signIn,
    null
  );

  return (
    // Covers the viewport rather than sitting in the page flow: the root layout
    // renders the site's nav and footer around every route, and a login form
    // wedged between them reads as part of the site.
    <main className="fixed inset-0 z-[200] flex items-center justify-center overflow-y-auto bg-white px-6">
      <div className="w-full max-w-sm">
        <span className="text-[11px] uppercase tracking-[0.22em] text-zinc-400">
          __PROJECT_NAME__
        </span>
        <h1 className="mt-3 text-[26px] leading-tight tracking-tight text-zinc-900">
          {COPY.title}
        </h1>
        <p className="mt-3 text-[14px] leading-relaxed text-zinc-500">
          {COPY.tagline}
        </p>

        {configured ? (
          <form action={formAction} className="mt-8">
            <label htmlFor="password" className="sr-only">
              {COPY.password}
            </label>
            <input
              id="password"
              name="password"
              type="password"
              autoComplete="current-password"
              required
              // 16px minimum, or iOS zooms the page on focus.
              className="w-full rounded-full border border-zinc-200 px-5 py-3 text-[16px] text-zinc-900 outline-none transition-colors placeholder:text-zinc-400 focus:border-zinc-400"
              placeholder={COPY.password}
            />
            <button
              type="submit"
              disabled={pending}
              className="mt-3 w-full rounded-full bg-zinc-900 px-6 py-3 text-sm font-medium text-white transition-transform hover:scale-[1.01] disabled:opacity-60"
            >
              {pending ? COPY.checking : COPY.enter}
            </button>
            {error ? (
              <p role="alert" className="mt-3 text-[13px] text-red-600">
                {error}
              </p>
            ) : null}
          </form>
        ) : (
          // Without this the missing variable looks like a broken page.
          <p className="mt-8 rounded-xl bg-zinc-50 px-4 py-3 text-[13px] leading-relaxed text-zinc-600 ring-1 ring-zinc-200">
            {COPY.notConfiguredPre} <code className="text-zinc-900">STUDIO_PASSWORD</code>
            {COPY.notConfiguredMid}
            <code className="text-zinc-900">.env.local</code>
            {COPY.notConfiguredPost}
          </p>
        )}
      </div>
    </main>
  );
}
