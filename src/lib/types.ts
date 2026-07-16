export type Violation = {
  id: string;
  violation_date: string; // YYYY-MM-DD
  description: string;
  created_at: string;
  // Internal ownership pointer for "delete your own report" — never render
  // this in the UI, it's not for display, only for ownership checks.
  created_by_user_id: string | null;
};

export type ViolationImageRow = {
  id: string;
  violation_id: string;
  image_path: string;
  thumb_path: string;
  width: number;
  height: number;
  sort_order: number;
};

export type PlateNumberRow = {
  id: string;
  violation_id: string;
  plate_text: string;
};

// Violation joined with its images (resolved to signed URLs) and plates,
// as rendered on the day-view feed and detail page. occurrenceCount is how
// many times this normalized plate has been reported across all history,
// not just on this violation's date.
export type ViolationWithDetails = Violation & {
  images: (ViolationImageRow & { url: string; thumbUrl: string })[];
  plates: (PlateNumberRow & { occurrenceCount: number })[];
};
