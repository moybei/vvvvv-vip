import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { isAllowedEmail } from "@/lib/auth";
import { processUploadedImage } from "@/lib/image";
import { uploadToR2, deleteFromR2 } from "@/lib/r2";

// Comfortably under Vercel's ~4.5MB per-request body limit for serverless
// functions — client-side compression targets ~2MB, this just guards
// against a pathological case (e.g. an incompressible image).
const MAX_FILE_BYTES = 4 * 1024 * 1024;

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user || !isAllowedEmail(user.email)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const formData = await request.formData();
  const date = String(formData.get("date") ?? "");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return NextResponse.json({ error: "Invalid date" }, { status: 400 });
  }

  const file = formData.get("image");
  if (!(file instanceof File) || file.size === 0) {
    return NextResponse.json({ error: "No photo provided" }, { status: 400 });
  }
  if (file.size > MAX_FILE_BYTES) {
    return NextResponse.json({ error: "Photo is too large" }, { status: 413 });
  }

  try {
    const inputBuffer = Buffer.from(await file.arrayBuffer());
    const { full, thumb } = await processUploadedImage(inputBuffer);

    const { data: reserved, error: seqErr } = await supabase.rpc(
      "reserve_daily_image_indexes",
      { p_date: date, p_count: 1 },
    );
    if (seqErr) throw seqErr;

    const folder = date.replace(/-/g, "");
    const seq = String(reserved as number).padStart(2, "0");
    const imagePath = `${folder}/${seq}-full.jpg`;
    const thumbPath = `${folder}/${seq}-thumb.jpg`;

    await Promise.all([
      uploadToR2(imagePath, full.buffer, "image/jpeg"),
      uploadToR2(thumbPath, thumb.buffer, "image/jpeg"),
    ]);

    return NextResponse.json({
      imagePath,
      thumbPath,
      width: full.width,
      height: full.height,
    });
  } catch (err) {
    console.error("upload-photo failed:", err);
    return NextResponse.json({ error: "Failed to process photo" }, { status: 500 });
  }
}

// Only allow deleting the temporary paths this route produces:
// `YYYYMMDD/NN-full.jpg` or `YYYYMMDD/NN-thumb.jpg`.
const TEMP_PATH_RE = /^\d{8}\/\d{2,}-(full|thumb)\.jpg$/;

export async function DELETE(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user || !isAllowedEmail(user.email)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  const paths = (body as { paths?: unknown })?.paths;
  if (
    !Array.isArray(paths) ||
    paths.length === 0 ||
    paths.length > 10 ||
    !paths.every((p): p is string => typeof p === "string" && TEMP_PATH_RE.test(p))
  ) {
    return NextResponse.json({ error: "Invalid paths" }, { status: 400 });
  }

  // Refuse to delete anything already attached to a violation.
  const { data: referenced, error: refErr } = await supabase
    .from("violation_images")
    .select("image_path")
    .in("image_path", paths);
  if (refErr) {
    console.error("upload-photo DELETE lookup failed:", refErr);
    return NextResponse.json({ error: "Failed to delete photo" }, { status: 500 });
  }
  if (referenced && referenced.length > 0) {
    return NextResponse.json({ error: "Photo is already attached to a report" }, { status: 409 });
  }

  try {
    await deleteFromR2(paths);
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("upload-photo DELETE failed:", err);
    return NextResponse.json({ error: "Failed to delete photo" }, { status: 500 });
  }
}
