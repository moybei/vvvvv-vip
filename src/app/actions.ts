"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { isAllowedEmail } from "@/lib/auth";
import { normalizePlate } from "@/lib/plate";
import { createViolation, deleteViolation } from "@/lib/violations";

const MAX_IMAGES = 10;

// Note: these actions are called imperatively from client components
// (`await someAction(...)`, not `<form action={someAction}>`), so they
// deliberately never call redirect() themselves — when a Server Action
// invoked that way calls redirect(), the thrown redirect signal surfaces
// as a normal rejected promise to the caller's own try/catch, which read as
// a generic failure even though the save/delete had already succeeded.
// Instead these return a plain result and the client navigates itself.

export async function createViolationAction(input: {
  date: string;
  description: string;
  plates: string[];
  images: { imagePath: string; thumbPath: string; width: number; height: number }[];
}): Promise<{ ok: true; date: string; violationId: string } | { error: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user || !isAllowedEmail(user.email)) {
    return { error: "Your session expired. Please refresh and sign in again." };
  }

  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.date)) {
    return { error: "Missing or invalid date." };
  }

  const description = input.description.trim();
  const plates = Array.from(new Set(input.plates.map(normalizePlate).filter(Boolean)));
  const images = input.images;

  if (images.length === 0) {
    return { error: "At least one photo is required." };
  }
  if (images.length > MAX_IMAGES) {
    return { error: `Please upload at most ${MAX_IMAGES} photos.` };
  }

  let violationId: string;
  try {
    violationId = await createViolation(supabase, {
      date: input.date,
      description,
      plates,
      images,
      createdByUserId: user.id,
    });
  } catch (err) {
    console.error("createViolationAction failed:", err);
    return { error: "Something went wrong saving the report. Please try again." };
  }

  revalidatePath("/");
  return { ok: true, date: input.date, violationId };
}

export async function deleteViolationAction(
  violationId: string,
): Promise<{ ok: true; date: string } | { error: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user || !isAllowedEmail(user.email)) {
    return { error: "Your session expired. Please refresh and sign in again." };
  }

  let result: { ok: true; date: string } | { ok: false; error: string };
  try {
    result = await deleteViolation(supabase, violationId, user.id);
  } catch (err) {
    console.error("deleteViolationAction failed:", err);
    return { error: "Something went wrong deleting the report. Please try again." };
  }

  if (!result.ok) {
    return { error: result.error };
  }

  revalidatePath("/");
  return { ok: true, date: result.date };
}

export async function signOutAction(): Promise<{ ok: true }> {
  const supabase = await createClient();
  await supabase.auth.signOut();
  return { ok: true };
}
