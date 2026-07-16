import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { DeleteButton } from "@/components/DeleteButton";
import { PlateChipLink } from "@/components/PlateChipLink";
import { formatMalaysiaDateTime } from "@/lib/datetime";
import { createClient } from "@/lib/supabase/server";
import { getViolationById } from "@/lib/violations";

export default async function ViolationDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const violation = await getViolationById(supabase, id);

  if (!violation) notFound();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  const isOwner = !!user && user.id === violation.created_by_user_id;

  return (
    <div className="mx-auto max-w-3xl">
      <Link
        href={`/?date=${violation.violation_date}`}
        className="mb-4 inline-flex items-center gap-1 text-sm font-medium text-foreground/60 hover:text-foreground"
      >
        ← Back to {violation.violation_date}
      </Link>

      <div className="flex flex-col items-center gap-3">
        {violation.images.map((img) => (
          <div key={img.id} className="w-full max-w-md overflow-hidden rounded-xl bg-surface-muted">
            <Image
              src={img.url}
              alt="Violation photo"
              width={img.width}
              height={img.height}
              sizes="(max-width: 448px) 100vw, 448px"
              className="h-auto w-full"
              unoptimized
            />
          </div>
        ))}
      </div>

      {violation.plates.length > 0 && (
        <div className="mt-5 flex flex-wrap gap-2">
          {violation.plates.map((p) => (
            <PlateChipLink key={p.id} plateText={p.plate_text} occurrenceCount={p.occurrenceCount} size="lg" />
          ))}
        </div>
      )}

      <p className="mt-4 whitespace-pre-wrap text-sm text-foreground/80">
        {violation.description || "No description provided."}
      </p>

      <p className="mt-6 text-xs text-foreground/45">
        Reported {formatMalaysiaDateTime(violation.created_at)}
      </p>

      {isOwner && <DeleteButton violationId={violation.id} />}
    </div>
  );
}
