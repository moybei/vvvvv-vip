import Link from "next/link";
import { format, parseISO } from "date-fns";
import { createClient } from "@/lib/supabase/server";
import { getViolationsByPlate } from "@/lib/violations";
import { normalizePlate } from "@/lib/plate";
import { ViolationGrid } from "@/components/ViolationGrid";
import type { ViolationWithDetails } from "@/lib/types";

export default async function PlatePage({
  params,
}: {
  params: Promise<{ plate: string }>;
}) {
  const { plate: rawPlate } = await params;
  const plateText = normalizePlate(decodeURIComponent(rawPlate));

  const supabase = await createClient();
  const violations = await getViolationsByPlate(supabase, plateText);

  const groups = new Map<string, ViolationWithDetails[]>();
  for (const v of violations) {
    const list = groups.get(v.violation_date) ?? [];
    list.push(v);
    groups.set(v.violation_date, list);
  }
  const sortedDates = Array.from(groups.keys()).sort((a, b) => b.localeCompare(a));

  return (
    <div>
      <Link
        href="/"
        className="mb-4 inline-flex items-center gap-1 text-sm font-medium text-foreground/60 hover:text-foreground"
      >
        ← Back to today
      </Link>

      <h1 className="mb-1 font-mono text-2xl font-extrabold tracking-wide">{plateText}</h1>
      <p className="mb-6 text-sm text-foreground/60">
        {violations.length} report{violations.length === 1 ? "" : "s"} found
      </p>

      {sortedDates.length === 0 && (
        <p className="rounded-2xl border border-dashed border-black/10 bg-surface-muted/60 py-10 text-center text-sm text-foreground/60 dark:border-white/10">
          No reports found for this plate.
        </p>
      )}

      {sortedDates.map((date) => (
        <div key={date} className="mb-8">
          <h2 className="mb-3 text-sm font-semibold text-foreground/70">
            {format(parseISO(date), "EEEE, d MMMM yyyy")}
          </h2>
          <ViolationGrid violations={groups.get(date)!} dateLabel={date} />
        </div>
      ))}
    </div>
  );
}
