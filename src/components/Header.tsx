import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { MobileUserMenu } from "@/components/MobileUserMenu";
import { SignOutButton } from "@/components/SignOutButton";

export async function Header() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <header className="sticky top-0 z-10 border-b border-black/5 bg-surface/90 backdrop-blur dark:border-white/10">
      <div className="h-1.5 w-full bg-[repeating-linear-gradient(45deg,var(--color-brand-yellow)_0,var(--color-brand-yellow)_14px,var(--color-brand-dark)_14px,var(--color-brand-dark)_28px)]" />
      <div className="mx-auto flex max-w-5xl items-center justify-between gap-3 px-4 py-3">
        <Link href="/" className="flex items-baseline gap-2">
          <span className="text-lg font-extrabold tracking-tight">VIP</span>
          <span className="hidden text-xs font-medium text-foreground/50 sm:inline">
            ViTrox Interesting Parking
          </span>
        </Link>
        <div className="flex items-center gap-2 sm:gap-3">
          <Link
            href="/upload"
            className="rounded-lg bg-brand-red px-3 py-1.5 text-sm font-semibold text-white transition hover:brightness-95 sm:px-4"
          >
            + Report
          </Link>
          {user && (
            <>
              <div className="hidden items-center gap-2 sm:flex">
                <span className="max-w-[12rem] truncate text-xs text-foreground/50">
                  {user.email}
                </span>
                <SignOutButton />
              </div>
              <MobileUserMenu email={user.email ?? null} />
            </>
          )}
        </div>
      </div>
    </header>
  );
}
