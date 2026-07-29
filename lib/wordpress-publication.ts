import "server-only";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { buildWordPressContent } from "@/lib/wordpress-draft-bridge";

export interface WordPressPublicationState {
  state: "requested" | "draft_created" | "published" | "failed";
  externalId: string | null;
  externalUrl: string | null;
  updatedAt: string;
}

export async function getWordPressPublicationState(
  storyId: string,
): Promise<WordPressPublicationState | null> {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("publication_records")
    .select("state,external_id,external_url,updated_at")
    .eq("story_id", storyId)
    .eq("platform", "wordpress")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!data) return null;
  return {
    state: data.state,
    externalId: data.external_id,
    externalUrl: data.external_url,
    updatedAt: data.updated_at,
  };
}

export async function buildApprovedWordPressPayload(storyId: string) {
  const supabase = await createSupabaseServerClient();
  const [{ data: story, error }, { data: sources }] = await Promise.all([
    supabase
      .from("stories")
      .select("id,title,summary,body,social_embed_url,image_url,status")
      .eq("id", storyId)
      .single(),
    supabase
      .from("story_sources")
      .select("url")
      .eq("story_id", storyId)
      .order("created_at", { ascending: true }),
  ]);

  if (error || !story) throw new Error("story_not_found");
  if (story.status !== "approved") throw new Error("story_not_approved");

  return {
    status: "publish",
    title: story.title,
    content: buildWordPressContent(story, sources ?? []),
    excerpt: story.summary ?? "",
    media_urls: story.image_url ? [story.image_url] : [],
  };
}
