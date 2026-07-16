"use client";

import { signOutAction } from "@/app/actions";

export function SignOutButton() {
  return (
    <button
      type="button"
      onClick={() => signOutAction()}
      className="text-xs font-medium text-foreground/50 underline-offset-2 hover:underline"
    >
      Sign out
    </button>
  );
}
