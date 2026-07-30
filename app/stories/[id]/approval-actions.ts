"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { requireRole } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { publishWordPressPost } from "@/lib/wordpress-client";
import { buildApprovedWordPressPayload } from "@/lib/wordpress-publication";

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
  if (normalized.includes("image") || normalized.includes("fallback")) return "image";
  if (normalized.includes("awaiting approval")) return "wrong_stage";
  return "failed";
}

function publicationFailureCode(message: string): string {
  const normalized = message.toLowerCase();
  if (
    normalized.includes("permission") ||
    normalized.includes("scope") ||
    normalized.includes("token") ||
    normalized.includes("connect")
  ) {
    return "wordpress_connection";
  }
  if (normalized.includes("image") || normalized.includes("media")) return "image";
  return "publish_failed";
}

async function publishApprovedStory(
  storyId: string,
  publicationRecordId: string,
): Promise<string | null> {
  const supabase = await createSupabaseServerClient();
  try {
    const payload = await buildApprovedWordPressPayload(storyId);
    const result = await publishWordPressPost(payload);
    if (result.dryRun) throw new Error("WordPress production publishing is in dry-run mode");

    const { error: finishError } = await supabase.rpc("finish_approved_wordpress_publication", {
      p_publication_record_id: publicationRecordId,
      p_success: true,
      p_external_id: result.id,
      p_external_url: result.link,
      p_error: null,
    });
    if (finishError) throw new Error(finishError.message);
    return null;
  } catch (error) {
    const message = error instanceof Error ? error.message : "WordPress publication failed";
    await supabase.rpc("finish_approved_wordpress_publication", {
      p_publication_record_id: publicationRecordId,
      p_success: false,
      p_external_id: null,
      p_external_url: null,
      p_error: message,
    });
    return publicationFailureCode(message);
  }
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
  if (decision === "approved") {
    const { data: publicationRecordId, error: beginError } = await supabase.rpc(
      "begin_approved_wordpress_publication",
      {
        p_story_id: storyId,
        p_expected_updated_at: expectedUpdatedAt,
        p_note: note || null,
      },
    );

    if (beginError || !publicationRecordId) {
      redirect(`/stories/${storyId}?approval_error=${failureCode(beginError?.message ?? "failed")}`);
    }

    const publicationError = await publishApprovedStory(storyId, publicationRecordId);
    if (publicationError) {
      revalidatePath("/");
      revalidatePath(`/stories/${storyId}`);
      redirect(`/stories/${storyId}?publication_error=${publicationError}`);
    }

    revalidatePath("/");
    revalidatePath("/approval-queue");
    revalidatePath(`/stories/${storyId}`);
    redirect(`/stories/${storyId}?published=1`);
  }

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

export async function retryWordPressPublicationAction(formData: FormData) {
  await requireRole(reviewerRoles);
  const storyId = value(formData, "storyId");
  if (!storyId) redirect("/?publication_error=invalid_input");

  const supabase = await createSupabaseServerClient();
  const { data: publicationRecordId, error: beginError } = await supabase.rpc(
    "begin_wordpress_publication_retry",
    { p_story_id: storyId },
  );
  if (beginError || !publicationRecordId) {
    redirect(
      `/stories/${storyId}?publication_error=${publicationFailureCode(
        beginError?.message ?? "WordPress retry could not start",
      )}`,
    );
  }

  const publicationError = await publishApprovedStory(storyId, publicationRecordId);
  revalidatePath("/");
  revalidatePath("/approval-queue");
  revalidatePath(`/stories/${storyId}`);
  if (publicationError) {
    redirect(`/stories/${storyId}?publication_error=${publicationError}`);
  }
  redirect(`/stories/${storyId}?published=1`);
}
