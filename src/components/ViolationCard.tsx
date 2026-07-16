import Image from "next/image";
import Link from "next/link";
import { PlateChipLink } from "@/components/PlateChipLink";
import { formatMalaysiaTime } from "@/lib/datetime";
import type { ViolationWithDetails } from "@/lib/types";

export function ViolationCard({ violation }: { violation: ViolationWithDetails }) {
  const cover = violation.images[0];
  const extraCount = violation.images.length - 1;

  return (
    <Link
      id={violation.id}
      href={`/violations/${violation.id}`}
      className="group flex flex-col overflow-hidden rounded-2xl border border-black/5 bg-surface shadow-sm transition hover:shadow-md dark:border-white/10"
    >
      <div className="relative aspect-[4/3] w-full bg-surface-muted">
        {cover && (
          <Image
            src={cover.thumbUrl}
            alt="Violation photo"
            fill
            sizes="(max-width: 640px) 100vw, 33vw"
            className="object-cover"
            unoptimized
          />
        )}
        {extraCount > 0 && (
          <span className="absolute right-2 top-2 rounded-full bg-black/70 px-2 py-0.5 text-xs font-semibold text-white">
            +{extraCount}
          </span>
        )}
      </div>
      <div className="flex flex-1 flex-col gap-2 p-3">
        {violation.plates.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {violation.plates.map((p) => (
              <PlateChipLink key={p.id} plateText={p.plate_text} occurrenceCount={p.occurrenceCount} />
            ))}
          </div>
        )}
        <p className="line-clamp-2 text-sm text-foreground/80">
          {violation.description || "No description."}
        </p>
        <div className="mt-auto pt-1 text-right text-xs text-foreground/45">
          {formatMalaysiaTime(violation.created_at)}
        </div>
      </div>
    </Link>
  );
}
