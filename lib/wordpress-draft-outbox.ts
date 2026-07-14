import "server-only";

import { createSupabaseServerClient } from "@/lib/supabase/server";

export interface WordPressDraftPackage {
  id: string;
  storyId: string;
  createdAt: string;
  storySnapshot: Record<string, unknown>;
  checklistSnapshot: Record<string, unknown>;
  approvalSnapshot: Record<string, unknown>;
  existingOutboxId: string | null;
}

export function isWordPressDraftOutboxEnabled(): boolean {
  return process.env.CAIOS_WORDPRESS_DRAFT_OUTBOX_ENABLED === "true";
}

export function buildWordPressDraftPayload(packageRecord: WordPressDraftPackage) {
  const title = String(packageRecord.storySnapshot.title ?? "Untitled story");
  const content = String(packageRecord.storySnapshot.body ?? "");
  const excerpt = String(packageRecord.storySnapshot.summary ?? "");

  return {
    status: "draft" as const,
    title,
    content,
    excerpt,
    meta: {
      caios_package_id: packageRecord.id,
      caios_story_id: packageRecord.storyId,
      human_approved: true,
    },
  };
}

export async function getWordPressDraftPackage(id: string): Promise<WordPressDraftPackage | null> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("editorial_packages")
    .select("id, story_id, created_at, story_snapshot, checklist_snapshot, approval_snapshot, wordpress_draft_outbox(id, state)")
    .eq("id", id)
    .single();

  if (error || !data) return null;

  const raw = data as unknown as {
    id: string;
    story_id: string;
    created_at: string;
    story_snapshot: Record<string, unknown>;
    checklist_snapshot: Record<string, unknown>;
    approval_snapshot: Record<string, unknown>;
    wordpress_draft_outbox: Array<{ id: string; state: string }> | null;
  };

  const queued = raw.wordpress_draft_outbox?.find((item) => item.state === "queued");

  return {
    id: raw.id,
    storyId: raw.story_id,
    createdAt: raw.created_at,
    storySnapshot: raw.story_snapshot,
    checklistSnapshot: raw.checklist_snapshot,
    approvalSnapshot: raw.approval_snapshot,
    existingOutboxId: queued?.id ?? null,
  };
}
