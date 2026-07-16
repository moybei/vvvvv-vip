// Canonical plate format so the same plate always matches for occurrence
// counting, regardless of how someone typed it (spaces, casing, etc).
export function normalizePlate(raw: string): string {
  return raw.toUpperCase().replace(/\s+/g, "");
}
