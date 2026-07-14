"use server";

import { redirect } from "next/navigation";

import { requireRole } from "@/lib/auth";
import { validateStoryEdit } from "@/lib/story-edit";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const editorRoles = ["administrator", "editor", "producer", "researcher"] as const;

export async function updateStory(formData: FormData) {
  await requireRole(editorRoles);
  const result = validateStoryEdit(formData);

  if (!result.value) {
    const storyId = String(formData.get("storyId") ?? "");
    redirect(`/stories/${encodeURIComponent(storyId)}/edit?error=${encodeURIComponent(result.errors.join(" "))}`);
  }

  const value = result.value;
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc("update_story_with_audit", {
    p_story_id: value.storyId,
    p_expected_updated_at: value.expectedUpdatedAt,
    p_title: value.title,
    p_desk: value.desk,
    p_priority: value.priority,
    p_summary: value.summary,
    p_body: value.body,
    p_target_status: value.targetStatus,
  });

  if (error) {
    const message = error.message.includes("changed by another user")
      ? "This story changed after you opened it. Reload and review the newer version before saving."
      : "Story update failed. No changes were applied.";
    redirect(`/stories/${encodeURIComponent(value.storyId)}/edit?error=${encodeURIComponent(message)}`);
  }

  redirect(`/stories/${encodeURIComponent(value.storyId)}/edit?saved=1`);
}
