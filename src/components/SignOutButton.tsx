"use client";

import { useRouter } from "next/navigation";
import { signOutAction } from "@/app/actions";

export function SignOutButton() {
  const router = useRouter();

  return (
    <button
      type="button"
      onClick={async () => {
        await signOutAction();
        router.push("/login");
      }}
      className="text-xs font-medium text-foreground/50 underline-offset-2 hover:underline"
    >
      Sign out
    </button>
  );
}
