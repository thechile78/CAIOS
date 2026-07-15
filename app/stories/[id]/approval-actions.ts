"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { requireRole } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const checklistRoles = ["administrator", "editor", "producer", "researcher", "reviewer"] as const;
const reviewerRoles = ["administrator", "editor", "reviewer"] as const;
const decisions = new Set(["approved", "rejected", "changes_requested"]);

function value(formData: FormData, key: string): string {
  return String(formData.get(key) ?? "").trim();
}

function checked(formData: FormData, key: string): boolean {
  return formData.get(key) === "on";
}

function failureCode(message: string): string {
  const normalized = message.toLowerCase();
  if (normalized.includes("stale") || normalized.includes("changed")) return "conflict";
  if (normalized.includes("checklist") || normalized.includes("incomplete")) return "checklist";
  if (normalized.includes("awaiting approval")) return "wrong_stage";
  return "failed";
}

export async function saveEditorialChecklistAction(formData: FormData) {
  await requireRole(checklistRoles);
  const storyId = value(formData, "storyId");
  const expectedUpdatedAt = value(formData, "expectedUpdatedAt");
  if (!storyId || !expectedUpdatedAt) redirect(`/stories/${storyId || "unknown"}?approval_error=invalid_input`);

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc("save_editorial_checklist", {
    p_story_id: storyId,
    p_expected_updated_at: expectedUpdatedAt,
    p_sources_verified: checked(formData, "sourcesVerified"),
    p_facts_verified: checked(formData, "factsVerified"),
    p_rights_reviewed: checked(formData, "rightsReviewed"),
    p_seo_reviewed: checked(formData, "seoReviewed"),
  });

  if (error) redirect(`/stories/${storyId}?approval_error=${failureCode(error.message)}`);
  revalidatePath("/");
  revalidatePath(`/stories/${storyId}`);
  redirect(`/stories/${storyId}?checklist_saved=1`);
}

export async function recordEditorialDecisionAction(formData: FormData) {
  await requireRole(reviewerRoles);
  const storyId = value(formData, "storyId");
  const expectedUpdatedAt = value(formData, "expectedUpdatedAt");
  const decision = value(formData, "decision");
  const note = value(formData, "note");
  if (!storyId || !expectedUpdatedAt || !decisions.has(decision) || note.length > 4000) {
    redirect(`/stories/${storyId || "unknown"}?approval_error=invalid_input`);
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc("record_editorial_decision", {
    p_story_id: storyId,
    p_expected_updated_at: expectedUpdatedAt,
    p_decision: decision,
    p_note: note || null,
  });

  if (error) redirect(`/stories/${storyId}?approval_error=${failureCode(error.message)}`);
  revalidatePath("/");
  revalidatePath(`/stories/${storyId}`);
  redirect(`/stories/${storyId}?decision_recorded=${decision}`);
}
