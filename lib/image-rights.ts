import "server-only";

import { createSupabaseServerClient } from "@/lib/supabase/server";

export interface StoryImageRights {
  id: string;
  imageUrl: string;
  sourcePageUrl: string;
  sourceType: string;
  creator: string;
  licenseName: string;
  licenseUrl: string | null;
  attributionText: string;
  altText: string;
  commercialUseAllowed: boolean;
  modificationsAllowed: boolean;
  retrievedAt: string;
  approvedAt: string;
}

export interface OpenverseImage {
  id: string;
  title: string;
  creator: string;
  imageUrl: string;
  thumbnailUrl: string;
  sourcePageUrl: string;
  licenseName: string;
  licenseUrl: string;
  attributionText: string;
}

function httpsUrl(value: unknown): string | null {
  if (typeof value !== "string") return null;
  try {
    const url = new URL(value);
    return url.protocol === "https:" ? url.toString() : null;
  } catch {
    return null;
  }
}

export async function getApprovedStoryImage(storyId: string): Promise<StoryImageRights | null> {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("story_image_rights")
    .select("id,image_url,source_page_url,source_type,creator,license_name,license_url,attribution_text,alt_text,commercial_use_allowed,modifications_allowed,retrieved_at,approved_at")
    .eq("story_id", storyId)
    .eq("active", true)
    .maybeSingle();

  if (!data) return null;
  return {
    id: data.id,
    imageUrl: data.image_url,
    sourcePageUrl: data.source_page_url,
    sourceType: data.source_type,
    creator: data.creator,
    licenseName: data.license_name,
    licenseUrl: data.license_url,
    attributionText: data.attribution_text,
    altText: data.alt_text,
    commercialUseAllowed: data.commercial_use_allowed,
    modificationsAllowed: data.modifications_allowed,
    retrievedAt: data.retrieved_at,
    approvedAt: data.approved_at,
  };
}

export async function searchOpenverseImages(query: string): Promise<OpenverseImage[]> {
  const cleaned = query.replace(/\s+/g, " ").trim().slice(0, 120);
  if (cleaned.length < 3) return [];

  const endpoint = new URL("https://api.openverse.org/v1/images/");
  endpoint.searchParams.set("q", cleaned);
  endpoint.searchParams.set("license", "cc0");
  endpoint.searchParams.set("mature", "false");
  endpoint.searchParams.set("page_size", "6");

  try {
    const response = await fetch(endpoint, {
      headers: { accept: "application/json", "user-agent": "CAIOS/5.2 image-rights-search" },
      cache: "no-store",
      signal: AbortSignal.timeout(8_000),
    });
    if (!response.ok) return [];

    const body = await response.json() as {
      results?: Array<Record<string, unknown>>;
    };

    return (body.results ?? []).flatMap((item): OpenverseImage[] => {
      const imageUrl = httpsUrl(item.url);
      const thumbnailUrl = httpsUrl(item.thumbnail);
      const sourcePageUrl = httpsUrl(item.foreign_landing_url);
      if (!imageUrl || !thumbnailUrl || !sourcePageUrl || item.license !== "cc0") return [];

      const creator = typeof item.creator === "string" && item.creator.trim()
        ? item.creator.trim().slice(0, 300)
        : "Creator not identified";
      const title = typeof item.title === "string" && item.title.trim()
        ? item.title.trim().slice(0, 300)
        : cleaned;
      const licenseUrl = httpsUrl(item.license_url) ?? "https://creativecommons.org/publicdomain/zero/1.0/";

      return [{
        id: typeof item.id === "string" ? item.id : `${sourcePageUrl}-${imageUrl}`,
        title,
        creator,
        imageUrl,
        thumbnailUrl,
        sourcePageUrl,
        licenseName: "CC0 1.0",
        licenseUrl,
        attributionText: `${title} — ${creator} (CC0 1.0)`,
      }];
    }).slice(0, 3);
  } catch {
    return [];
  }
}
