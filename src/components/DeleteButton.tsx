"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { deleteViolationAction } from "@/app/actions";

export function DeleteButton({ violationId }: { violationId: string }) {
  const router = useRouter();
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleDelete() {
    if (!window.confirm("Delete this report? This can't be undone.")) return;

    setIsDeleting(true);
    setError(null);

    try {
      const result = await deleteViolationAction(violationId);
      if ("error" in result) {
        setError(result.error);
        setIsDeleting(false);
      } else {
        router.push(`/?date=${result.date}`);
      }
    } catch {
      setError("Something went wrong. Please try again.");
      setIsDeleting(false);
    }
  }

  return (
    <div className="mt-2">
      <button
        type="button"
        onClick={handleDelete}
        disabled={isDeleting}
        className="rounded-lg border border-brand-red px-3 py-1.5 text-sm font-semibold text-brand-red transition hover:bg-brand-red/10 disabled:opacity-50"
      >
        {isDeleting ? "Deleting…" : "Delete report"}
      </button>
      {error && <p className="mt-2 text-sm text-brand-red">{error}</p>}
    </div>
  );
}
