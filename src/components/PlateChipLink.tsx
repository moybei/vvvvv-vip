"use client";

import { useRouter } from "next/navigation";
import { PlateChip } from "@/components/PlateChip";

// Plain <PlateChip> is used inside <ViolationCard>, which is itself a
// <Link> — nesting a real anchor inside another anchor is invalid HTML, so
// this navigates via a click handler (with stopPropagation, so tapping a
// plate doesn't also trigger the card's own link) instead of a nested <a>.
export function PlateChipLink({
  plateText,
  occurrenceCount,
  size,
}: {
  plateText: string;
  occurrenceCount: number;
  size?: "sm" | "lg";
}) {
  const router = useRouter();

  return (
    <button
      type="button"
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        router.push(`/plates/${encodeURIComponent(plateText)}`);
      }}
    >
      <PlateChip plateText={plateText} occurrenceCount={occurrenceCount} size={size} />
    </button>
  );
}
