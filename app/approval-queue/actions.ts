"use server";

import { redirect } from "next/navigation";

import { handoffRoles } from "@/lib/approval-handoff";
import { requireRole } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function requestApprovedStoryHandoff(formData: FormData) {
  await requireRole(handoffRoles);

  const storyId = formData.get("storyId");
  const expectedUpdatedAt = formData.get("expectedUpdatedAt");
  const noteValue = formData.get("note");

  if (
    typeof storyId !== "string" ||
    typeof expectedUpdatedAt !== "string" ||
    !storyId ||
    !expectedUpdatedAt
  ) {
    redirect("/approval-queue?error=Invalid%20handoff%20request.");
  }

  const note = typeof noteValue === "string" ? noteValue.trim() : "";
  if (note.length > 2000) {
    redirect("/approval-queue?error=Handoff%20note%20is%20too%20long.");
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc("request_approved_story_handoff", {
    p_story_id: storyId,
    p_expected_updated_at: expectedUpdatedAt,
    p_note: note || null,
  });

  if (error) {
    const message = error.message.toLowerCase();
    if (message.includes("stale story version")) {
      redirect("/approval-queue?error=This%20story%20changed.%20Reload%20and%20try%20again.");
    }
    redirect("/approval-queue?error=The%20handoff%20request%20was%20not%20accepted.");
  }

  redirect("/approval-queue?handoff=requested");
}
