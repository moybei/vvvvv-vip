import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { processUploadedImage } from "@/lib/image";
import { deleteFromR2, getR2SignedUrls, uploadToR2 } from "@/lib/r2";
import type {
  PlateNumberRow,
  Violation,
  ViolationImageRow,
  ViolationWithDetails,
} from "@/lib/types";

const SIGNED_URL_TTL_SECONDS = 60 * 60; // 1 hour, enough for one page view

// How many times each normalized plate has been reported across ALL
// history, not just the violations currently being rendered — so a repeat
// offender is flagged even if their other reports are from a different day.
async function getPlateOccurrenceCounts(
  supabase: SupabaseClient,
  plateTexts: string[],
): Promise<Map<string, number>> {
  const uniqueTexts = Array.from(new Set(plateTexts));
  if (uniqueTexts.length === 0) return new Map();

  const { data, error } = await supabase
    .from("plate_numbers")
    .select("plate_text")
    .in("plate_text", uniqueTexts);

  if (error) throw error;

  const counts = new Map<string, number>();
  for (const row of data ?? []) {
    counts.set(row.plate_text, (counts.get(row.plate_text) ?? 0) + 1);
  }
  return counts;
}

async function attachSignedUrls(
  supabase: SupabaseClient,
  violations: Violation[],
  images: ViolationImageRow[],
  plates: PlateNumberRow[],
): Promise<ViolationWithDetails[]> {
  const imagePaths = images.map((i) => i.image_path);
  const thumbPaths = images.map((i) => i.thumb_path);

  const [fullUrls, thumbUrls, occurrenceCounts] = await Promise.all([
    imagePaths.length ? getR2SignedUrls(imagePaths, SIGNED_URL_TTL_SECONDS) : Promise.resolve([]),
    thumbPaths.length ? getR2SignedUrls(thumbPaths, SIGNED_URL_TTL_SECONDS) : Promise.resolve([]),
    getPlateOccurrenceCounts(supabase, plates.map((p) => p.plate_text)),
  ]);

  const fullUrlByPath = new Map(imagePaths.map((path, i) => [path, fullUrls[i]]));
  const thumbUrlByPath = new Map(thumbPaths.map((path, i) => [path, thumbUrls[i]]));

  return violations.map((violation) => {
    const violationImages = images
      .filter((img) => img.violation_id === violation.id)
      .sort((a, b) => a.sort_order - b.sort_order)
      .map((img) => ({
        ...img,
        url: fullUrlByPath.get(img.image_path) ?? "",
        thumbUrl: thumbUrlByPath.get(img.thumb_path) ?? "",
      }));

    const violationPlates = plates
      .filter((p) => p.violation_id === violation.id)
      .map((p) => ({ ...p, occurrenceCount: occurrenceCounts.get(p.plate_text) ?? 1 }));

    return { ...violation, images: violationImages, plates: violationPlates };
  });
}

export async function getViolationsByDate(
  supabase: SupabaseClient,
  date: string,
): Promise<ViolationWithDetails[]> {
  const { data: violations, error } = await supabase
    .from("violations")
    .select("*")
    .eq("violation_date", date)
    .order("created_at", { ascending: false });

  if (error) throw error;
  if (!violations?.length) return [];

  const ids = violations.map((v) => v.id);

  const [{ data: images, error: imgErr }, { data: plates, error: plateErr }] =
    await Promise.all([
      supabase.from("violation_images").select("*").in("violation_id", ids),
      supabase.from("plate_numbers").select("*").in("violation_id", ids),
    ]);

  if (imgErr) throw imgErr;
  if (plateErr) throw plateErr;

  return attachSignedUrls(supabase, violations, images ?? [], plates ?? []);
}

export async function getViolationById(
  supabase: SupabaseClient,
  id: string,
): Promise<ViolationWithDetails | null> {
  const { data: violation, error } = await supabase
    .from("violations")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (error) throw error;
  if (!violation) return null;

  const [{ data: images, error: imgErr }, { data: plates, error: plateErr }] =
    await Promise.all([
      supabase.from("violation_images").select("*").eq("violation_id", id),
      supabase.from("plate_numbers").select("*").eq("violation_id", id),
    ]);

  if (imgErr) throw imgErr;
  if (plateErr) throw plateErr;

  const [full] = await attachSignedUrls(supabase, [violation], images ?? [], plates ?? []);
  return full;
}

export async function createViolation(
  supabase: SupabaseClient,
  params: {
    date: string;
    description: string;
    plates: string[];
    files: File[];
    createdByUserId: string;
  },
): Promise<string> {
  const { data: violation, error } = await supabase
    .from("violations")
    .insert({
      violation_date: params.date,
      description: params.description,
      created_by_user_id: params.createdByUserId,
    })
    .select("id")
    .single();

  if (error) throw error;
  const violationId = violation.id as string;

  if (params.plates.length) {
    const { error: plateErr } = await supabase.from("plate_numbers").insert(
      params.plates.map((plateText) => ({
        violation_id: violationId,
        plate_text: plateText,
      })),
    );
    if (plateErr) throw plateErr;
  }

  for (let i = 0; i < params.files.length; i++) {
    const file = params.files[i];
    const inputBuffer = Buffer.from(await file.arrayBuffer());
    const { full, thumb } = await processUploadedImage(inputBuffer);

    const imagePath = `${violationId}/${i}-full.jpg`;
    const thumbPath = `${violationId}/${i}-thumb.jpg`;

    await Promise.all([
      uploadToR2(imagePath, full.buffer, "image/jpeg"),
      uploadToR2(thumbPath, thumb.buffer, "image/jpeg"),
    ]);

    const { error: imgErr } = await supabase.from("violation_images").insert({
      violation_id: violationId,
      image_path: imagePath,
      thumb_path: thumbPath,
      width: full.width,
      height: full.height,
      sort_order: i,
    });
    if (imgErr) throw imgErr;
  }

  return violationId;
}

export async function deleteViolation(
  supabase: SupabaseClient,
  id: string,
  requesterId: string,
): Promise<{ ok: true; date: string } | { ok: false; error: string }> {
  const { data: violation, error: fetchErr } = await supabase
    .from("violations")
    .select("violation_date, created_by_user_id")
    .eq("id", id)
    .maybeSingle();

  if (fetchErr) throw fetchErr;
  if (!violation) return { ok: false, error: "Report not found." };
  if (violation.created_by_user_id !== requesterId) {
    return { ok: false, error: "You can only delete your own reports." };
  }

  const { data: images, error: imgErr } = await supabase
    .from("violation_images")
    .select("image_path, thumb_path")
    .eq("violation_id", id);
  if (imgErr) throw imgErr;

  // Delete the DB row first (cascades to violation_images/plate_numbers).
  // If the R2 cleanup below fails, we're left with orphaned files rather
  // than a broken UI pointing at deleted images.
  const { error: delErr } = await supabase.from("violations").delete().eq("id", id);
  if (delErr) throw delErr;

  const paths = (images ?? []).flatMap((img) => [img.image_path, img.thumb_path]);
  await deleteFromR2(paths);

  return { ok: true, date: violation.violation_date };
}
