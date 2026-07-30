import "server-only";

import { getApprovedStoryImage } from "@/lib/image-rights";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { buildWordPressContent } from "@/lib/wordpress-draft-bridge";

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll('"', "&quot;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

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
  const approvedImage = await getApprovedStoryImage(storyId);
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
  if (!approvedImage || !approvedImage.commercialUseAllowed) {
    throw new Error("approved_image_missing");
  }

  const licenseReference = approvedImage.licenseUrl
    ? `${approvedImage.licenseName}: ${approvedImage.licenseUrl}`
    : approvedImage.licenseName;
  const imageCredit = `<p><strong>Image:</strong> ${escapeHtml(approvedImage.attributionText)}<br><strong>Source:</strong> <a href="${escapeHtml(approvedImage.sourcePageUrl)}">${escapeHtml(approvedImage.sourcePageUrl)}</a><br><strong>License:</strong> ${escapeHtml(licenseReference)}</p>`;

  return {
    status: "publish",
    title: story.title,
    content: [
      buildWordPressContent({ ...story, image_url: null }, sources ?? []),
      imageCredit,
    ].filter(Boolean).join("\n\n"),
    excerpt: story.summary ?? "",
    featured_image: {
      rights_record_id: approvedImage.id,
      url: approvedImage.imageUrl,
      source_page_url: approvedImage.sourcePageUrl,
      creator: approvedImage.creator,
      license_name: approvedImage.licenseName,
      license_url: approvedImage.licenseUrl,
      attribution_text: approvedImage.attributionText,
      alt_text: approvedImage.altText,
      commercial_use_allowed: approvedImage.commercialUseAllowed,
      modifications_allowed: approvedImage.modificationsAllowed,
      retrieved_at: approvedImage.retrievedAt,
      approved_at: approvedImage.approvedAt,
    },
  };
}
