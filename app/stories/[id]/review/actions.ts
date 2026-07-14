"use server";

import { redirect } from "next/navigation";

import { requireRole } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const checklistRoles = ["administrator", "editor", "producer", "researcher", "reviewer"] as const;
const reviewerRoles = ["administrator", "editor", "reviewer"] as const;

function bool(formData: FormData, name: string): boolean {
  return formData.get(name) === "on";
}

function requiredString(formData: FormData, name: string): string {
  const value = formData.get(name);
  if (typeof value !== "string" || !value.trim()) throw new Error(`${name} is required`);
  return value.trim();
}

export async function saveChecklist(formData: FormData) {
  await requireRole(checklistRoles);
  const storyId = requiredString(formData, "storyId");
  const expectedUpdatedAt = requiredString(formData, "expectedUpdatedAt");
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc("save_editorial_checklist", {
    p_story_id: storyId,
    p_expected_updated_at: expectedUpdatedAt,
    p_sources_verified: bool(formData, "sourcesVerified"),
    p_facts_verified: bool(formData, "factsVerified"),
    p_rights_reviewed: bool(formData, "rightsReviewed"),
    p_seo_reviewed: bool(formData, "seoReviewed"),
  });

  if (error) redirect(`/stories/${storyId}/review?error=${encodeURIComponent(error.message)}`);
  redirect(`/stories/${storyId}/review?saved=1`);
}

export async function recordDecision(formData: FormData) {
  await requireRole(reviewerRoles);
  const storyId = requiredString(formData, "storyId");
  const expectedUpdatedAt = requiredString(formData, "expectedUpdatedAt");
  const decision = requiredString(formData, "decision");
  const noteValue = formData.get("note");
  const note = typeof noteValue === "string" ? noteValue.trim().slice(0, 4000) : "";

  if (!['approved', 'rejected', 'changes_requested'].includes(decision)) {
    redirect(`/stories/${storyId}/review?error=Invalid%20decision`);
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc("record_editorial_decision", {
    p_story_id: storyId,
    p_expected_updated_at: expectedUpdatedAt,
    p_decision: decision,
    p_note: note || null,
  });

  if (error) redirect(`/stories/${storyId}/review?error=${encodeURIComponent(error.message)}`);
  redirect(`/stories/${storyId}/review?decision=${encodeURIComponent(decision)}`);
}
