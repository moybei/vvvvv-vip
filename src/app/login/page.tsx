import { Suspense } from "react";
import { GoogleSignInButton } from "@/components/GoogleSignInButton";

export default function LoginPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-surface-muted px-4">
      <div className="w-full max-w-sm rounded-2xl border border-black/5 bg-surface p-8 text-center shadow-sm dark:border-white/10">
        <div className="mx-auto mb-4 h-2 w-16 rounded-full bg-[repeating-linear-gradient(45deg,var(--color-brand-yellow)_0,var(--color-brand-yellow)_8px,var(--color-brand-dark)_8px,var(--color-brand-dark)_16px)]" />
        <h1 className="text-2xl font-bold tracking-tight">VIP</h1>
        <p className="mt-1 text-sm text-foreground/60">ViTrox Interesting Parking</p>
        <p className="mt-6 text-sm text-foreground/70">
          Sign in with your @vitrox.com Google account to view and report
          parking violations.
        </p>
        <div className="mt-6">
          <Suspense fallback={null}>
            <GoogleSignInButton />
          </Suspense>
        </div>
      </div>
    </div>
  );
}
