import Link from "next/link";

export default function AuthErrorPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-surface-muted px-4">
      <div className="w-full max-w-sm rounded-2xl border border-black/5 bg-surface p-8 text-center shadow-sm dark:border-white/10">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-brand-red/10 text-2xl">
          🚫
        </div>
        <h1 className="text-lg font-semibold">Not a ViTrox account</h1>
        <p className="mt-2 text-sm text-foreground/70">
          VIP is only available to @vitrox.com accounts. You&apos;ve been
          signed out — try again with your company Google account.
        </p>
        <Link
          href="/login"
          className="mt-6 inline-block rounded-lg bg-brand-yellow px-4 py-2 text-sm font-semibold text-brand-dark hover:brightness-95"
        >
          Back to sign in
        </Link>
      </div>
    </div>
  );
}
