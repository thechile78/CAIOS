"use server";

import { redirect } from "next/navigation";

import { requireRole } from "@/lib/auth";
import { sendWordPressDraft } from "@/lib/wordpress-client";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const dispatchRoles = ["administrator", "editor"] as const;

export async function dispatchWordPressDraft(formData: FormData) {
  await requireRole(dispatchRoles);
  const outboxId = String(formData.get("outboxId") ?? "");
  const expectedUpdatedAt = String(formData.get("expectedUpdatedAt") ?? "");
  if (!outboxId || !expectedUpdatedAt) redirect("/approvals?error=Invalid%20dispatch%20request.");

  const supabase = await createSupabaseServerClient();
  const claim = await supabase.rpc("begin_wordpress_draft_dispatch", {
    p_outbox_id: outboxId,
    p_expected_updated_at: expectedUpdatedAt,
  });

  if (claim.error || !claim.data) {
    redirect(`/outbox/${encodeURIComponent(outboxId)}/dispatch?error=${encodeURIComponent(claim.error?.message ?? "Unable to claim dispatch.")}`);
  }

  const claimed = claim.data as { payload?: unknown };
  try {
    const result = await sendWordPressDraft(claimed.payload);
    const finish = await supabase.rpc("finish_wordpress_draft_dispatch", {
      p_outbox_id: outboxId,
      p_success: true,
      p_external_post_id: result.id,
      p_external_post_url: result.link,
      p_error: null,
    });
    if (finish.error) throw finish.error;
    redirect(`/outbox/${encodeURIComponent(outboxId)}/dispatch?sent=${encodeURIComponent(result.dryRun ? "dry-run" : result.id)}`);
  } catch (error) {
    const message = error instanceof Error ? error.message : "WordPress dispatch failed";
    await supabase.rpc("finish_wordpress_draft_dispatch", {
      p_outbox_id: outboxId,
      p_success: false,
      p_external_post_id: null,
      p_external_post_url: null,
      p_error: message,
    });
    redirect(`/outbox/${encodeURIComponent(outboxId)}/dispatch?error=${encodeURIComponent(message)}`);
  }
}