import "server-only";

import { createSupabaseServerClient } from "@/lib/supabase/server";

export interface WordPressDraftPackage {
  id: string;
  storyId: string;
  handoffId: string;
  state: "prepared" | "exported" | "cancelled";
  title: string;
  excerpt: string | null;
  content: string | null;
  preparedAt: string;
  note: string | null;
}

export async function listWordPressDraftPackages(): Promise<WordPressDraftPackage[]> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("wordpress_draft_packages")
    .select("id, story_id, handoff_id, state, title_snapshot, excerpt_snapshot, content_snapshot, prepared_at, note")
    .neq("state", "cancelled")
    .order("prepared_at", { ascending: false })
    .limit(100);

  if (error) throw new Error("Unable to load WordPress draft packages.");

  return (data ?? []).map((row) => ({
    id: row.id,
    storyId: row.story_id,
    handoffId: row.handoff_id,
    state: row.state,
    title: row.title_snapshot,
    excerpt: row.excerpt_snapshot,
    content: row.content_snapshot,
    preparedAt: row.prepared_at,
    note: row.note,
  }));
}

export async function getWordPressDraftPackage(id: string): Promise<WordPressDraftPackage | null> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("wordpress_draft_packages")
    .select("id, story_id, handoff_id, state, title_snapshot, excerpt_snapshot, content_snapshot, prepared_at, note")
    .eq("id", id)
    .single();

  if (error || !data) return null;

  return {
    id: data.id,
    storyId: data.story_id,
    handoffId: data.handoff_id,
    state: data.state,
    title: data.title_snapshot,
    excerpt: data.excerpt_snapshot,
    content: data.content_snapshot,
    preparedAt: data.prepared_at,
    note: data.note,
  };
}
