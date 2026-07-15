"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { requireRole } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const editableRoles = ["administrator", "editor", "producer", "researcher"] as const;
const priorities = new Set(["breaking", "high", "normal", "low"]);
const allowedTargets = new Set(["discovered", "researching"]);

function value(formData: FormData, key: string): string {
  return String(formData.get(key) ?? "").trim();
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
    const code = error.message.toLowerCase().includes("stale") || error.message.toLowerCase().includes("updated")
      ? "conflict"
      : "save_failed";
    redirect(`/stories/${storyId}?editorial_error=${code}`);
  }

  revalidatePath("/");
  revalidatePath(`/stories/${storyId}`);
  redirect(`/stories/${storyId}?editorial_saved=${targetStatus}`);
}
