// ViTrox is in Malaysia; the server runtime (Vercel) runs in UTC, and a
// viewer's browser could be in any timezone if they're travelling. Always
// render/derive "today" and timestamps against this fixed zone rather than
// whatever the runtime's local timezone happens to be.
export const MALAYSIA_TIME_ZONE = "Asia/Kuala_Lumpur";

// "en-CA" formats as YYYY-MM-DD, which conveniently matches the
// violation_date column's format.
export function todayInMalaysia(): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: MALAYSIA_TIME_ZONE });
}

export function formatMalaysiaTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("en-MY", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: MALAYSIA_TIME_ZONE,
  });
}

export function formatMalaysiaDateTime(iso: string): string {
  return new Date(iso).toLocaleString("en-MY", {
    timeZone: MALAYSIA_TIME_ZONE,
    dateStyle: "medium",
    timeStyle: "short",
  });
}
