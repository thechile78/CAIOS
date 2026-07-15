import "server-only";

import { createHash } from "node:crypto";

import { createSupabaseServerClient } from "@/lib/supabase/server";

const approvedFeeds = [
  {
    name: "Loudwire",
    url: "https://loudwire.com/feed/",
    desk: "Rock",
    reliability: "established_trade",
  },
  {
    name: "Blabbermouth",
    url: "https://blabbermouth.net/feed",
    desk: "Rock",
    reliability: "established_trade",
  },
  {
    name: "KHOU 11",
    url: "https://www.khou.com/feeds/syndication/rss/news",
    desk: "Houston",
    reliability: "local_primary",
  },
] as const;

interface FeedItem {
  title: string;
  link: string;
  summary: string | null;
}

export interface DiscoveryRunResult {
  feedsChecked: number;
  itemsExamined: number;
  storiesCreated: number;
  duplicatesSkipped: number;
  feedErrors: string[];
}

function decodeXml(value: string): string {
  return value
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .trim();
}

function stripHtml(value: string): string {
  return decodeXml(value.replace(/<[^>]+>/g, " ").replace(/\s+/g, " "));
}

function readTag(block: string, tag: string): string | null {
  const match = block.match(new RegExp(`<${tag}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${tag}>`, "i"));
  return match ? decodeXml(match[1]) : null;
}

function parseFeed(xml: string): FeedItem[] {
  const blocks = xml.match(/<item(?:\s[^>]*)?>[\s\S]*?<\/item>/gi) ?? [];

  return blocks.flatMap((block) => {
    const title = readTag(block, "title");
    const link = readTag(block, "link") ?? readTag(block, "guid");
    if (!title || !link) return [];

    const description = readTag(block, "description") ?? readTag(block, "content:encoded");
    return [{
      title: stripHtml(title).slice(0, 300),
      link: link.trim(),
      summary: description ? stripHtml(description).slice(0, 1000) : null,
    }];
  });
}

function slugFor(title: string, link: string): string {
  const base = title
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 80) || "discovered-story";
  const suffix = createHash("sha256").update(link).digest("hex").slice(0, 10);
  return `${base}-${suffix}`;
}

function isHttpUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:";
  } catch {
    return false;
  }
}

export async function runApprovedFeedDiscovery(maxItemsPerFeed = 10): Promise<DiscoveryRunResult> {
  const supabase = await createSupabaseServerClient();
  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError || !userData.user) throw new Error("Authentication is required to run discovery.");

  const result: DiscoveryRunResult = {
    feedsChecked: 0,
    itemsExamined: 0,
    storiesCreated: 0,
    duplicatesSkipped: 0,
    feedErrors: [],
  };

  for (const feed of approvedFeeds) {
    result.feedsChecked += 1;

    try {
      const response = await fetch(feed.url, {
        headers: { "user-agent": "CAIOS-Newsroom-Discovery/1.0" },
        cache: "no-store",
        signal: AbortSignal.timeout(12_000),
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);

      const items = parseFeed(await response.text()).slice(0, maxItemsPerFeed);
      for (const item of items) {
        result.itemsExamined += 1;
        if (!item.title || !isHttpUrl(item.link)) continue;

        const { data: existing, error: duplicateError } = await supabase
          .from("story_sources")
          .select("id")
          .eq("url", item.link)
          .limit(1);
        if (duplicateError) throw duplicateError;
        if ((existing ?? []).length > 0) {
          result.duplicatesSkipped += 1;
          continue;
        }

        const { data: story, error: storyError } = await supabase
          .from("stories")
          .insert({
            title: item.title,
            slug: slugFor(item.title, item.link),
            desk: feed.desk,
            priority: "normal",
            status: "discovered",
            summary: item.summary,
            body: null,
            owner_id: null,
            created_by: userData.user.id,
            updated_by: userData.user.id,
          })
          .select("id")
          .single();
        if (storyError) throw storyError;

        const { error: sourceError } = await supabase.from("story_sources").insert({
          story_id: story.id,
          url: item.link,
          publisher: feed.name,
          title: item.title,
          reliability: feed.reliability,
          verified: false,
          created_by: userData.user.id,
        });

        if (sourceError) {
          await supabase.from("stories").delete().eq("id", story.id);
          throw sourceError;
        }

        result.storiesCreated += 1;
      }
    } catch (error) {
      result.feedErrors.push(`${feed.name}: ${error instanceof Error ? error.message : "Unknown feed error"}`);
    }
  }

  return result;
}
