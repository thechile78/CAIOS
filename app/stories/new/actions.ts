"use server";

import { redirect } from "next/navigation";

import { requireRole } from "@/lib/auth";
import { validateStoryForm } from "@/lib/story-input";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const creatorRoles = ["administrator", "editor", "producer", "researcher"] as const;

export async function createStory(formData: FormData) {
  await requireRole(creatorRoles);

  const result = validateStoryForm(formData);
  if (!result.value) {
    redirect(`/stories/new?error=${encodeURIComponent(result.errors.join(" "))}`);
  }

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc("create_story_with_audit", {
    p_title: result.value.title,
    p_desk: result.value.desk,
    p_priority: result.value.priority,
    p_summary: result.value.summary,
    p_body: result.value.body,
  });

  if (error || !data) {
    redirect("/stories/new?error=Story%20creation%20failed.");
  }

  redirect(`/?created=${encodeURIComponent(String(data))}`);
}
