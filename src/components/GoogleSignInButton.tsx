"use client";

import { useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export function GoogleSignInButton() {
  const searchParams = useSearchParams();
  const next = searchParams.get("next") ?? "/";

  async function handleSignIn() {
    const supabase = createClient();
    const redirectTo = new URL("/auth/callback", window.location.origin);
    redirectTo.searchParams.set("next", next);

    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: redirectTo.toString() },
    });
  }

  return (
    <button
      type="button"
      onClick={handleSignIn}
      className="inline-flex w-full items-center justify-center gap-2 rounded-lg border border-black/10 bg-white px-4 py-2.5 text-sm font-medium text-black shadow-sm transition hover:bg-black/[0.03] dark:border-white/15 dark:bg-white dark:text-black"
    >
      <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true">
        <path
          fill="#FFC107"
          d="M43.6 20.5H42V20.4H24v7.2h11.3c-1.6 4.6-6 8-11.3 8-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.9 1.2 8 3.1l5.4-5.4C34.1 6 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.2-.1-2.4-.4-3.5z"
        />
        <path
          fill="#FF3D00"
          d="m6.3 14.7 5.9 4.3C13.7 15.6 18.5 12.4 24 12.4c3.1 0 5.9 1.2 8 3.1l5.4-5.4C34.1 6.9 29.3 4.4 24 4.4c-7.6 0-14.2 4.3-17.7 10.6z"
        />
        <path
          fill="#4CAF50"
          d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.3C29.2 35.1 26.7 36 24 36c-5.3 0-9.7-3.4-11.3-8.1l-6.1 4.7C9.7 39.6 16.3 44 24 44z"
        />
        <path
          fill="#1976D2"
          d="M43.6 20.5H42V20.4H24v7.2h11.3c-.8 2.3-2.2 4.2-4.1 5.6l6.2 5.3C40.7 35.9 44 30.5 44 24c0-1.2-.1-2.4-.4-3.5z"
        />
      </svg>
      Sign in with Google
    </button>
  );
}
