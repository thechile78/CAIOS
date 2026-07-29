import "server-only";

import { createSupabaseServerClient } from "@/lib/supabase/server";

function escapeHtmlAttribute(value: string): string {
  return value.replaceAll("&", "&amp;").replaceAll('"', "&quot;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
}

function paragraphs(value: string): string {
  return value
    .split(/\n{2,}/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean)
    .map((paragraph) => `<p>${paragraph.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll("\n", "<br>")}</p>`)
    .join("\n");
}

function buildWordPressEmbed(value: unknown): string {
  if (typeof value !== "string" || !value.trim()) return "";
  const url = value.trim();
  let provider = "";
  let type = "rich";
  try {
    const host = new URL(url).hostname.replace(/^www\./, "");
    if (host === "youtube.com" || host === "youtu.be") {
      provider = "youtube";
      type = "video";
    } else if (host === "instagram.com") {
      provider = "instagram";
    } else if (host === "x.com" || host === "twitter.com") {
      provider = "twitter";
    } else {
      throw new Error("unsupported_social_provider");
    }
  } catch {
    throw new Error("unsupported_social_provider");
  }
  const safeUrl = escapeHtmlAttribute(url);
  return `<!-- wp:embed {"url":"${safeUrl}","type":"${type}","providerNameSlug":"${provider}"} -->\n<figure class="wp-block-embed is-type-${type} is-provider-${provider} wp-block-embed-${provider}"><div class="wp-block-embed__wrapper">\n${safeUrl}\n</div></figure>\n<!-- /wp:embed -->`;
}

export interface WordPressDraftBridgeState {
  handoff: null | {
    id: string;
    state: string;
    updatedAt: string;
    note: string | null;
  };
  editorialPackage: null | {
    id: string;
    createdAt: string;
    version: number;
  };
  outbox: null | {
    id: string;
    state: string;
    updatedAt: string;
    attemptCount: number;
    externalPostId: string | null;
    externalPostUrl: string | null;
    lastError: string | null;
  };
}

export async function getWordPressDraftBridgeState(
  storyId: string,
): Promise<WordPressDraftBridgeState> {
  const supabase = await createSupabaseServerClient();

  const { data: handoff } = await supabase
    .from("editorial_handoffs")
    .select("id,state,updated_at,note")
    .eq("story_id", storyId)
    .order("requested_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const { data: editorialPackage } = await supabase
    .from("editorial_packages")
    .select("id,created_at,package_version")
    .eq("story_id", storyId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const { data: outbox } = await supabase
    .from("wordpress_draft_outbox")
    .select("id,state,updated_at,attempt_count,external_post_id,external_post_url,last_error")
    .eq("story_id", storyId)
    .order("requested_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  return {
    handoff: handoff
      ? {
          id: handoff.id,
          state: handoff.state,
          updatedAt: handoff.updated_at,
          note: handoff.note,
        }
      : null,
    editorialPackage: editorialPackage
      ? {
          id: editorialPackage.id,
          createdAt: editorialPackage.created_at,
          version: editorialPackage.package_version,
        }
      : null,
    outbox: outbox
      ? {
          id: outbox.id,
          state: outbox.state,
          updatedAt: outbox.updated_at,
          attemptCount: outbox.attempt_count,
          externalPostId: outbox.external_post_id,
          externalPostUrl: outbox.external_post_url,
          lastError: outbox.last_error,
        }
      : null,
  };
}

export async function prepareWordPressDraftIntent(storyId: string): Promise<string> {
  const supabase = await createSupabaseServerClient();

  const { data: story, error: storyError } = await supabase
    .from("stories")
    .select("id,title,summary,body,social_embed_url,image_url,status,updated_at")
    .eq("id", storyId)
    .single();

  if (storyError || !story) throw new Error("story_not_found");
  if (story.status !== "approved") throw new Error("story_not_approved");

  const { data: sources } = await supabase
    .from("story_sources")
    .select("url,publisher,title,reliability,verified,created_at")
    .eq("story_id", storyId)
    .order("created_at", { ascending: true });

  let { data: handoff } = await supabase
    .from("editorial_handoffs")
    .select("id,state,updated_at")
    .eq("story_id", storyId)
    .order("requested_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!handoff) {
    const { data: handoffId, error } = await supabase.rpc(
      "request_approved_story_handoff",
      {
        p_story_id: storyId,
        p_expected_updated_at: story.updated_at,
        p_note: "Prepared from the CAIOS WordPress Draft Bridge. External request not yet made.",
      },
    );
    if (error || !handoffId) throw new Error(error?.message ?? "handoff_failed");

    const { data: createdHandoff, error: handoffReadError } = await supabase
      .from("editorial_handoffs")
      .select("id,state,updated_at")
      .eq("id", handoffId)
      .single();
    if (handoffReadError || !createdHandoff) throw new Error("handoff_read_failed");
    handoff = createdHandoff;
  }

  let { data: editorialPackage } = await supabase
    .from("editorial_packages")
    .select("id,created_at")
    .eq("handoff_id", handoff.id)
    .maybeSingle();

  if (!editorialPackage) {
    const { data: packageId, error } = await supabase.rpc(
      "package_approved_handoff",
      {
        p_handoff_id: handoff.id,
        p_expected_updated_at: handoff.updated_at,
        p_source_snapshot: sources ?? [],
      },
    );
    if (error || !packageId) throw new Error(error?.message ?? "package_failed");

    const { data: createdPackage, error: packageReadError } = await supabase
      .from("editorial_packages")
      .select("id,created_at")
      .eq("id", packageId)
      .single();
    if (packageReadError || !createdPackage) throw new Error("package_read_failed");
    editorialPackage = createdPackage;
  }

  const { data: existingOutbox } = await supabase
    .from("wordpress_draft_outbox")
    .select("id,state")
    .eq("package_id", editorialPackage.id)
    .in("state", ["queued", "processing", "sent"])
    .order("requested_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (existingOutbox) return existingOutbox.id;

  const storyContent = (story.body ?? "").trim() || (story.summary ?? "").trim();
  const sourceLinks = (sources ?? [])
    .map((source) => (typeof source.url === "string" ? source.url.trim() : ""))
    .filter(Boolean)
    .map((url) => `<p><strong>Read More <a href="${escapeHtmlAttribute(url)}">HERE</a></strong></p>`);
  const socialEmbed = buildWordPressEmbed(story.social_embed_url);
  const image = story.image_url
    ? `<figure class="wp-block-image"><img src="${escapeHtmlAttribute(story.image_url)}" alt="" /></figure>`
    : "";
  const content = [image, paragraphs(storyContent), ...sourceLinks, socialEmbed].filter(Boolean).join("\n\n");
  const payload = {
    status: "draft",
    title: story.title,
    content,
    excerpt: story.summary ?? "",
    media_urls: story.image_url ? [story.image_url] : [],
  };

  const { data: outboxId, error: queueError } = await supabase.rpc(
    "queue_wordpress_draft_intent",
    {
      p_package_id: editorialPackage.id,
      p_expected_created_at: editorialPackage.created_at,
      p_payload: payload,
    },
  );

  if (queueError || !outboxId) throw new Error(queueError?.message ?? "queue_failed");
  return outboxId;
}
