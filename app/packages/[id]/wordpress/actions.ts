"use server";

import { redirect } from "next/navigation";

import { requireRole } from "@/lib/auth";
import {
  buildWordPressDraftPayload,
  getWordPressDraftPackage,
  isWordPressDraftOutboxEnabled,
} from "@/lib/wordpress-draft-outbox";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const draftOutboxRoles = ["administrator", "editor"] as const;

export async function queueWordPressDraftIntent(formData: FormData) {
  await requireRole(draftOutboxRoles);

  const packageId = String(formData.get("packageId") ?? "");
  const expectedCreatedAt = String(formData.get("expectedCreatedAt") ?? "");

  if (!packageId || !expectedCreatedAt) {
    redirect("/approvals?error=Invalid%20WordPress%20draft%20request.");
  }

  if (!isWordPressDraftOutboxEnabled()) {
    redirect(`/packages/${encodeURIComponent(packageId)}/wordpress?error=WordPress%20draft%20outbox%20is%20disabled.`);
  }

  const packageRecord = await getWordPressDraftPackage(packageId);
  if (!packageRecord) {
    redirect(`/packages/${encodeURIComponent(packageId)}/wordpress?error=Package%20not%20found.`);
  }

  const payload = buildWordPressDraftPayload(packageRecord);
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc("queue_wordpress_draft_intent", {
    p_package_id: packageId,
    p_expected_created_at: expectedCreatedAt,
    p_payload: payload,
  });

  if (error || !data) {
    redirect(`/packages/${encodeURIComponent(packageId)}/wordpress?error=${encodeURIComponent(error?.message ?? "Draft intent failed.")}`);
  }

  redirect(`/packages/${encodeURIComponent(packageId)}/wordpress?queued=${encodeURIComponent(String(data))}`);
}
