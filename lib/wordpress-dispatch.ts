import "server-only";

import { createSupabaseServerClient } from "@/lib/supabase/server";

export type WordPressDispatchState = "queued" | "processing" | "sent" | "failed" | "cancelled";

export interface WordPressDispatchRecord {
  id: string;
  packageId: string;
  storyId: string;
  state: WordPressDispatchState;
  payload: Record<string, unknown>;
  updatedAt: string;
  attemptCount: number;
  externalPostId: string | null;
  externalPostUrl: string | null;
  lastError: string | null;
}

export async function getWordPressDispatchRecord(id: string): Promise<WordPressDispatchRecord | null> {
  const supabase = await createSupabaseServerClient();
  const result = await supabase
    .from("wordpress_draft_outbox")
    .select("id, package_id, story_id, state, payload, updated_at, attempt_count, external_post_id, external_post_url, last_error")
    .eq("id", id)
    .single();

  if (result.error || !result.data) return null;
  const row = result.data as any;
  return {
    id: row.id,
    packageId: row.package_id,
    storyId: row.story_id,
    state: row.state,
    payload: row.payload,
    updatedAt: row.updated_at,
    attemptCount: row.attempt_count,
    externalPostId: row.external_post_id,
    externalPostUrl: row.external_post_url,
    lastError: row.last_error,
  };
}