import { ViolationCard } from "@/components/ViolationCard";
import type { ViolationWithDetails } from "@/lib/types";

export function ViolationGrid({
  violations,
  dateLabel,
}: {
  violations: ViolationWithDetails[];
  dateLabel: string;
}) {
  if (violations.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-black/10 bg-surface-muted/60 py-16 text-center dark:border-white/10">
        <p className="text-3xl">🅿️</p>
        <p className="mt-2 text-sm font-medium text-foreground/70">
          No violations reported for {dateLabel}.
        </p>
        <p className="mt-1 text-xs text-foreground/45">
          Spotted a bad parking job? Tap &ldquo;+ Report&rdquo; above.
        </p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {violations.map((v) => (
        <ViolationCard key={v.id} violation={v} />
      ))}
    </div>
  );
}
