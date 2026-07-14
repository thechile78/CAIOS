"use server";

import { redirect } from "next/navigation";

import { requireRole } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const packagingRoles = ["administrator", "editor", "producer"] as const;

export async function prepareWordPressDraftPackage(formData: FormData) {
  await requireRole(packagingRoles);

  const handoffId = String(formData.get("handoffId") ?? "");
  const expectedUpdatedAt = String(formData.get("expectedUpdatedAt") ?? "");
  const note = String(formData.get("note") ?? "").trim() || null;

  if (!handoffId || !expectedUpdatedAt || (note && note.length > 2000)) {
    redirect("/approval-queue?error=Invalid%20draft%20package%20request.");
  }

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc("prepare_wordpress_draft_package", {
    p_handoff_id: handoffId,
    p_expected_story_updated_at: expectedUpdatedAt,
    p_note: note,
  });

  if (error || !data) {
    redirect("/approval-queue?error=Draft%20package%20preparation%20failed.");
  }

  redirect(`/wordpress-drafts/${encodeURIComponent(String(data))}`);
}
