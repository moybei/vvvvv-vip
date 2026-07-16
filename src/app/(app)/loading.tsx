export default function Loading() {
  return (
    <div className="flex flex-col gap-6">
      <div className="h-[52px] w-full max-w-xs animate-pulse rounded-xl bg-surface-muted sm:w-auto" />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div
            key={i}
            className="overflow-hidden rounded-2xl border border-black/5 bg-surface shadow-sm dark:border-white/10"
          >
            <div className="aspect-[4/3] w-full animate-pulse bg-surface-muted" />
            <div className="flex flex-col gap-2 p-3">
              <div className="h-5 w-20 animate-pulse rounded bg-surface-muted" />
              <div className="h-3 w-full animate-pulse rounded bg-surface-muted" />
              <div className="h-3 w-2/3 animate-pulse rounded bg-surface-muted" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
