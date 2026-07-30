"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { requireRole } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const reviewerRoles = ["administrator", "editor", "reviewer"] as const;
const allowedSourceTypes = new Set([
  "openverse",
  "wordpress_photo_directory",
  "official_press",
  "owned",
  "branded_fallback",
]);

function value(formData: FormData, key: string, max: number): string {
  return String(formData.get(key) ?? "").trim().slice(0, max);
}

function checked(formData: FormData, key: string): boolean {
  return formData.get(key) === "on" || formData.get(key) === "true";
}

function failureCode(message: string): string {
  const normalized = message.toLowerCase();
  if (normalized.includes("locked") || normalized.includes("approved story")) return "locked";
  if (normalized.includes("https")) return "https";
  if (normalized.includes("commercial")) return "commercial";
  if (normalized.includes("license") || normalized.includes("rights")) return "rights";
  return "failed";
}

export async function approveStoryImageAction(formData: FormData) {
  await requireRole(reviewerRoles);
  const storyId = value(formData, "storyId", 80);
  const sourceType = value(formData, "sourceType", 50);
  const imageUrl = value(formData, "imageUrl", 3000);
  const sourcePageUrl = value(formData, "sourcePageUrl", 3000);
  const creator = value(formData, "creator", 300);
  const licenseName = value(formData, "licenseName", 200);
  const licenseUrl = value(formData, "licenseUrl", 3000);
  const attributionText = value(formData, "attributionText", 1000);
  const altText = value(formData, "altText", 500);
  const retrievedAt = value(formData, "retrievedAt", 80);
  const commercialUseAllowed = checked(formData, "commercialUseAllowed");
  const modificationsAllowed = checked(formData, "modificationsAllowed");

  if (
    !storyId ||
    !allowedSourceTypes.has(sourceType) ||
    !imageUrl ||
    !sourcePageUrl ||
    !creator ||
    !licenseName ||
    !attributionText ||
    !altText ||
    !commercialUseAllowed
  ) {
    redirect(`/stories/${storyId || "unknown"}?image_error=invalid_input#image-rights`);
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc("record_story_image_approval", {
    p_story_id: storyId,
    p_image_url: imageUrl,
    p_source_page_url: sourcePageUrl,
    p_source_type: sourceType,
    p_creator: creator,
    p_license_name: licenseName,
    p_license_url: licenseUrl || null,
    p_attribution_text: attributionText,
    p_alt_text: altText,
    p_commercial_use_allowed: commercialUseAllowed,
    p_modifications_allowed: modificationsAllowed,
    p_retrieved_at: retrievedAt || new Date().toISOString(),
  });

  if (error) redirect(`/stories/${storyId}?image_error=${failureCode(error.message)}#image-rights`);
  revalidatePath(`/stories/${storyId}`);
  redirect(`/stories/${storyId}?image_approved=1#image-rights`);
}
