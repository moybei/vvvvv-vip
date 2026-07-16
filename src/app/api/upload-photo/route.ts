import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { isAllowedEmail } from "@/lib/auth";
import { processUploadedImage } from "@/lib/image";
import { uploadToR2 } from "@/lib/r2";

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
