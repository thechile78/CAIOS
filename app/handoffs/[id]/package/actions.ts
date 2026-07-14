"use server";

import { redirect } from "next/navigation";

import { requireRole } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const packagingRoles = ["administrator", "editor", "producer"] as const;

export async function createInternalPackage(formData: FormData) {
  await requireRole(packagingRoles);

  const handoffId = String(formData.get("handoffId") ?? "");
  const expectedUpdatedAt = String(formData.get("expectedUpdatedAt") ?? "");

  if (!handoffId || !expectedUpdatedAt) {
    redirect("/approvals?error=Invalid%20packaging%20request.");
  }

  const supabase = await createSupabaseServerClient();
  const { data: handoff, error: handoffError } = await supabase
    .from("editorial_handoffs")
    .select("story_id")
    .eq("id", handoffId)
    .single();

  if (handoffError || !handoff) {
    redirect(`/handoffs/${encodeURIComponent(handoffId)}/package?error=Handoff%20not%20found.`);
  }

  const { data: sources, error: sourceError } = await supabase
    .from("sources")
    .select("*")
    .eq("story_id", handoff.story_id);

  if (sourceError) {
    redirect(`/handoffs/${encodeURIComponent(handoffId)}/package?error=Source%20snapshot%20failed.`);
  }

  const { data, error } = await supabase.rpc("package_approved_handoff", {
    p_handoff_id: handoffId,
    p_expected_updated_at: expectedUpdatedAt,
    p_source_snapshot: sources ?? [],
  });

  if (error || !data) {
    redirect(`/handoffs/${encodeURIComponent(handoffId)}/package?error=${encodeURIComponent(error?.message ?? "Packaging failed.")}`);
  }

  redirect(`/handoffs/${encodeURIComponent(handoffId)}/package?packaged=${encodeURIComponent(String(data))}`);
}
