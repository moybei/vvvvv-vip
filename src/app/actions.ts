"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { isAllowedEmail } from "@/lib/auth";
import { normalizePlate } from "@/lib/plate";
import { createViolation, deleteViolation } from "@/lib/violations";

const MAX_IMAGES = 10;
const MAX_FILE_BYTES = 15 * 1024 * 1024; // 15MB per file, pre-resize on the client already shrinks this a lot

export async function createViolationAction(
  formData: FormData,
): Promise<{ error: string } | void> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user || !isAllowedEmail(user.email)) {
    redirect("/login");
  }

  const date = String(formData.get("date") ?? "");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return { error: "Missing or invalid date." };
  }

  const description = String(formData.get("description") ?? "").trim();

  const plates = Array.from(
    new Set(
      formData
        .getAll("plates")
        .map((p) => normalizePlate(String(p)))
        .filter(Boolean),
    ),
  );

  const files = formData.getAll("images").filter((f): f is File => f instanceof File && f.size > 0);

  if (files.length === 0) {
    return { error: "At least one photo is required." };
  }
  if (files.length > MAX_IMAGES) {
    return { error: `Please upload at most ${MAX_IMAGES} photos.` };
  }
  if (files.some((f) => f.size > MAX_FILE_BYTES)) {
    return { error: "One of the photos is too large." };
  }

  let violationId: string;
  try {
    violationId = await createViolation(supabase, {
      date,
      description,
      plates,
      files,
      createdByUserId: user!.id,
    });
  } catch (err) {
    console.error("createViolationAction failed:", err);
    return { error: "Something went wrong saving the report. Please try again." };
  }

  revalidatePath("/");
  redirect(`/?date=${date}#${violationId}`);
}

export async function deleteViolationAction(
  violationId: string,
): Promise<{ error: string } | void> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user || !isAllowedEmail(user.email)) {
    redirect("/login");
  }

  let result: { ok: true; date: string } | { ok: false; error: string };
  try {
    result = await deleteViolation(supabase, violationId, user!.id);
  } catch (err) {
    console.error("deleteViolationAction failed:", err);
    return { error: "Something went wrong deleting the report. Please try again." };
  }

  if (!result.ok) {
    return { error: result.error };
  }

  revalidatePath("/");
  redirect(`/?date=${result.date}`);
}

export async function signOutAction() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
