"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { requireRole } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const editableRoles = ["administrator", "editor", "producer", "researcher"] as const;
const priorities = new Set(["breaking", "high", "normal", "low"]);
const allowedTargets = new Set([
  "discovered",
  "researching",
  "fact_check",
  "drafting",
  "seo_review",
  "asset_review",
  "awaiting_approval",
]);

function value(formData: FormData, key: string): string {
  return String(formData.get(key) ?? "").trim();
}

function isHttpsUrl(value: string): boolean {
  if (!value) return true;
  try {
    return new URL(value).protocol === "https:";
  } catch {
    return false;
  }
}

function isSupportedSocialUrl(value: string): boolean {
  if (!value) return true;
  try {
    const host = new URL(value).hostname.replace(/^www\./, "");
    return ["x.com", "twitter.com", "instagram.com", "youtube.com", "youtu.be"].includes(host);
  } catch {
    return false;
  }
}

export async function saveStoryEditorialAction(formData: FormData) {
  await requireRole(editableRoles);

  const storyId = value(formData, "storyId");
  const expectedUpdatedAt = value(formData, "expectedUpdatedAt");
  const title = value(formData, "title");
  const desk = value(formData, "desk");
  const priority = value(formData, "priority");
  const summary = value(formData, "summary");
  const body = value(formData, "body");
  const targetStatus = value(formData, "targetStatus");

  if (!storyId || !expectedUpdatedAt || title.length < 8 || title.length > 220 || !desk || desk.length > 80 || !priorities.has(priority) || !allowedTargets.has(targetStatus)) {
    redirect(`/stories/${storyId || "unknown"}?editorial_error=invalid_input`);
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc("update_story_with_audit", {
    p_story_id: storyId,
    p_expected_updated_at: expectedUpdatedAt,
    p_title: title,
    p_desk: desk,
    p_priority: priority,
    p_summary: summary || null,
    p_body: body || null,
    p_target_status: targetStatus,
  });

  if (error) {
    const normalized = error.message.toLowerCase();
    const code = normalized.includes("stale") || normalized.includes("changed")
      ? "conflict"
      : normalized.includes("transition")
        ? "invalid_transition"
        : "save_failed";
    redirect(`/stories/${storyId}?editorial_error=${code}`);
  }

  revalidatePath("/");
  revalidatePath(`/stories/${storyId}`);
  redirect(`/stories/${storyId}?editorial_saved=${targetStatus}`);
}

export async function submitStoryForApprovalAction(formData: FormData) {
  await requireRole(editableRoles);

  const storyId = value(formData, "storyId");
  const expectedUpdatedAt = value(formData, "expectedUpdatedAt");
  const title = value(formData, "title");
  const desk = value(formData, "desk");
  const priority = value(formData, "priority");
  const summary = value(formData, "summary");
  const body = value(formData, "body");
  const socialEmbedUrl = value(formData, "socialEmbedUrl");
  const imageUrl = value(formData, "imageUrl");

  if (
    !storyId
    || !expectedUpdatedAt
    || title.length < 8
    || title.length > 220
    || !desk
    || desk.length > 80
    || !priorities.has(priority)
    || !isSupportedSocialUrl(socialEmbedUrl)
    || !isHttpsUrl(socialEmbedUrl)
    || !isHttpsUrl(imageUrl)
  ) {
    redirect(`/stories/${storyId || "unknown"}?editorial_error=invalid_input`);
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc("submit_story_for_approval", {
    p_story_id: storyId,
    p_expected_updated_at: expectedUpdatedAt,
    p_title: title,
    p_desk: desk,
    p_priority: priority,
    p_summary: summary || null,
    p_body: body || null,
    p_social_embed_url: socialEmbedUrl || null,
    p_image_url: imageUrl || null,
    p_sources_verified: formData.get("sourcesVerified") === "on",
    p_facts_verified: formData.get("factsVerified") === "on",
    p_rights_reviewed: formData.get("rightsReviewed") === "on",
    p_seo_reviewed: formData.get("seoReviewed") === "on",
  });

  if (error) {
    const normalized = error.message.toLowerCase();
    const code = normalized.includes("changed") ? "conflict"
      : normalized.includes("checklist") ? "checklist"
        : "save_failed";
    redirect(`/stories/${storyId}?editorial_error=${code}`);
  }

  revalidatePath("/");
  revalidatePath(`/stories/${storyId}`);
  redirect(`/stories/${storyId}?editorial_saved=awaiting_approval`);
}
