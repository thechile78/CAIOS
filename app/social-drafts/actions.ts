"use server";

import { redirect } from "next/navigation";

import { requireRole } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const creatorRoles = ["administrator", "editor", "producer", "researcher"] as const;
const reviewerRoles = ["administrator", "editor", "reviewer"] as const;

function requiredString(formData: FormData, name: string): string {
  const value = formData.get(name);
  if (typeof value !== "string" || !value.trim()) throw new Error(`${name} is required`);
  return value.trim();
}

function optionalString(formData: FormData, name: string, maxLength: number): string | null {
  const value = formData.get(name);
  if (typeof value !== "string") return null;
  const normalized = value.trim();
  if (normalized.length > maxLength) throw new Error(`${name} exceeds its maximum length`);
  return normalized || null;
}

function failure(message: string): never {
  redirect(`/social-drafts?error=${encodeURIComponent(message)}`);
}

export async function createSocialDraft(formData: FormData) {
  await requireRole(creatorRoles);

  let title: string;
  let facebookCaption: string | null;
  let instagramCaption: string | null;
  try {
    title = requiredString(formData, "title");
    facebookCaption = optionalString(formData, "facebookCaption", 5000);
    instagramCaption = optionalString(formData, "instagramCaption", 2200);
  } catch {
    failure("Review the draft fields and try again.");
  }

  if (title.length > 160 || (!facebookCaption && !instagramCaption)) {
    failure("A title and at least one platform caption are required.");
  }

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc("create_social_content_draft", {
    p_title: title,
    p_facebook_caption: facebookCaption,
    p_instagram_caption: instagramCaption,
  });

  if (error || !data) failure("The private draft could not be created.");
  redirect(`/social-drafts?created=${encodeURIComponent(String(data))}`);
}

export async function submitSocialDraftForReview(formData: FormData) {
  await requireRole(creatorRoles);
  const contentItemId = requiredString(formData, "contentItemId");
  const expectedUpdatedAt = requiredString(formData, "expectedUpdatedAt");
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc("submit_social_content_for_review", {
    p_content_item_id: contentItemId,
    p_expected_updated_at: expectedUpdatedAt,
  });

  if (error) failure("The draft changed or could not be submitted for review.");
  redirect(`/social-drafts?submitted=${encodeURIComponent(contentItemId)}`);
}

export async function recordSocialDraftDecision(formData: FormData) {
  await requireRole(reviewerRoles);
  const contentItemId = requiredString(formData, "contentItemId");
  const expectedUpdatedAt = requiredString(formData, "expectedUpdatedAt");
  const decision = requiredString(formData, "decision");
  const note = optionalString(formData, "note", 4000);

  if (!["approved", "changes_requested", "rejected"].includes(decision)) {
    failure("Invalid review decision.");
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc("record_social_content_decision", {
    p_content_item_id: contentItemId,
    p_expected_updated_at: expectedUpdatedAt,
    p_decision: decision,
    p_note: note,
  });

  if (error) failure("The draft changed or is no longer awaiting review.");
  redirect(`/social-drafts?decision=${encodeURIComponent(decision)}`);
}
