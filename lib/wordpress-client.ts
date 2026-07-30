import "server-only";

import { getWordPressConnection } from "@/lib/social-token-vault";
import {
  assertWordPressScopes,
  inspectWordPressToken,
} from "@/lib/wordpress-oauth";

export interface WordPressPostResult {
  id: string;
  link: string | null;
  dryRun: boolean;
}

interface ApprovedFeaturedImage {
  url: string;
  source_page_url: string;
  creator: string;
  license_name: string;
  license_url: string | null;
  attribution_text: string;
  alt_text: string;
  commercial_use_allowed: true;
}

function required(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is not configured`);
  return value;
}

export function isWordPressDispatchEnabled(): boolean {
  return process.env.CAIOS_WORDPRESS_DRAFT_DISPATCH_ENABLED === "true";
}

export function isWordPressDryRun(): boolean {
  return process.env.CAIOS_WORDPRESS_DRAFT_DRY_RUN !== "false";
}

export function validateWordPressPostPayload(
  payload: unknown,
  expectedStatus: "draft" | "publish",
): asserts payload is Record<string, unknown> {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) throw new Error("invalid WordPress payload");
  const record = payload as Record<string, unknown>;
  if (record.status !== expectedStatus) throw new Error(`WordPress status must be ${expectedStatus}`);
  for (const forbidden of ["date", "date_gmt", "password", "author"]) {
    if (forbidden in record) throw new Error(`prohibited WordPress field: ${forbidden}`);
  }

  const image = record.featured_image;
  if (!image || typeof image !== "object" || Array.isArray(image)) {
    throw new Error("approved featured image is required");
  }
  const featured = image as Record<string, unknown>;
  for (const field of [
    "url",
    "source_page_url",
    "creator",
    "license_name",
    "attribution_text",
    "alt_text",
  ]) {
    if (typeof featured[field] !== "string" || featured[field].trim().length === 0) {
      throw new Error(`featured image ${field} is required`);
    }
  }
  for (const field of ["url", "source_page_url"]) {
    const url = new URL(String(featured[field]));
    if (url.protocol !== "https:") throw new Error(`featured image ${field} must use HTTPS`);
  }
  if (featured.commercial_use_allowed !== true) {
    throw new Error("featured image must allow commercial use");
  }
}

function encodeWordPressPost(
  payload: Record<string, unknown>,
  featuredImageId: string,
  expectedStatus: "draft" | "publish",
): URLSearchParams {
  const body = new URLSearchParams();
  for (const field of ["title", "content", "excerpt"] as const) {
    const value = payload[field];
    if (typeof value === "string") body.set(field, value);
  }
  const mediaUrls = payload.media_urls;
  if (Array.isArray(mediaUrls)) {
    for (const url of mediaUrls) {
      if (typeof url === "string" && url.startsWith("https://")) body.append("media_urls[]", url);
    }
  }
  body.set("status", expectedStatus);
  body.set("publicize", "false");
  body.set("featured_image", featuredImageId);
  return body;
}

function getEndpoint(resource: "posts/new" | "media/new"): URL {
  const site = required("CAIOS_WORDPRESS_SITE");
  const path = resource === "posts/new" ? "posts/new/" : "media/new/";
  return new URL(
    `https://public-api.wordpress.com/rest/v1.1/sites/${encodeURIComponent(site)}/${path}`,
  );
}

function getWordPressError(responseText: string): string | null {
  try {
    const error = JSON.parse(responseText) as { error?: unknown; message?: unknown };
    const parts = [error.error, error.message].filter(
      (value): value is string => typeof value === "string" && value.length > 0,
    );
    return parts.length > 0 ? parts.join(": ").slice(0, 300) : null;
  } catch {
    return null;
  }
}

async function getValidWordPressAccessToken(): Promise<string> {
  const connection = await getWordPressConnection();
  if (connection) {
    assertWordPressScopes(connection.scopes);
    const verified = await inspectWordPressToken(connection.accessToken);
    if (verified.blogId !== connection.blogId) {
      throw new Error("WordPress connection belongs to a different site. Reconnect WordPress.");
    }
    return verified.accessToken;
  }

  const legacyToken = process.env.CAIOS_WORDPRESS_OAUTH_ACCESS_TOKEN?.trim();
  if (!legacyToken) {
    throw new Error(
      "WordPress is not connected. An administrator must reconnect WordPress with posts and media permissions.",
    );
  }
  const verified = await inspectWordPressToken(legacyToken);
  return verified.accessToken;
}

async function uploadWordPressFeaturedImage(
  image: ApprovedFeaturedImage,
  accessToken: string,
): Promise<string> {
  const body = new URLSearchParams();
  body.set("media_urls[]", image.url);
  body.set("attrs[0][title]", image.alt_text);
  body.set("attrs[0][caption]", image.attribution_text);
  body.set(
    "attrs[0][description]",
    `${image.attribution_text}\nSource: ${image.source_page_url}\nLicense: ${image.license_name}${
      image.license_url ? ` (${image.license_url})` : ""
    }`,
  );
  body.set("attrs[0][alt]", image.alt_text);

  const response = await fetch(getEndpoint("media/new"), {
    method: "POST",
    headers: {
      authorization: `Bearer ${accessToken}`,
      "content-type": "application/x-www-form-urlencoded",
      "user-agent": "CAIOS/5.2",
    },
    body,
    cache: "no-store",
    redirect: "error",
    signal: AbortSignal.timeout(15_000),
  });
  const responseText = await response.text();
  if (!response.ok) {
    const detail = getWordPressError(responseText);
    throw new Error(
      `WordPress media request failed with HTTP ${response.status}${detail ? `: ${detail}` : ""}`,
    );
  }

  const responseBody = JSON.parse(responseText) as {
    media?: Array<{ ID?: number | string }>;
  };
  const mediaId = responseBody.media?.[0]?.ID;
  if (mediaId === undefined) throw new Error("WordPress response did not include a media id");
  return String(mediaId);
}

async function sendWordPressPost(
  payload: unknown,
  expectedStatus: "draft" | "publish",
): Promise<WordPressPostResult> {
  if (!isWordPressDispatchEnabled()) throw new Error("WordPress draft dispatch is disabled");
  validateWordPressPostPayload(payload, expectedStatus);

  if (isWordPressDryRun()) {
    return { id: "dry-run", link: null, dryRun: true };
  }

  const accessToken = await getValidWordPressAccessToken();
  const image = payload.featured_image as unknown as ApprovedFeaturedImage;
  const featuredImageId = await uploadWordPressFeaturedImage(image, accessToken);
  const body = encodeWordPressPost(payload, featuredImageId, expectedStatus);
  const response = await fetch(getEndpoint("posts/new"), {
    method: "POST",
    headers: {
      authorization: `Bearer ${accessToken}`,
      "content-type": "application/x-www-form-urlencoded",
      "user-agent": "CAIOS/5.2",
    },
    body,
    cache: "no-store",
    redirect: "error",
    signal: AbortSignal.timeout(15_000),
  });

  const responseText = await response.text();
  if (!response.ok) {
    const detail = getWordPressError(responseText);
    throw new Error(
      `WordPress ${expectedStatus} request failed with HTTP ${response.status}${detail ? `: ${detail}` : ""}`,
    );
  }
  const responseBody = JSON.parse(responseText) as {
    ID?: number | string;
    URL?: string;
    status?: string;
  };
  if (responseBody.ID === undefined) throw new Error("WordPress response did not include a post id");
  if (responseBody.status !== expectedStatus) {
    throw new Error(`WordPress did not confirm ${expectedStatus} status`);
  }
  return {
    id: String(responseBody.ID),
    link: typeof responseBody.URL === "string" ? responseBody.URL : null,
    dryRun: false,
  };
}

export async function sendWordPressDraft(payload: unknown): Promise<WordPressPostResult> {
  return sendWordPressPost(payload, "draft");
}

export async function publishWordPressPost(payload: unknown): Promise<WordPressPostResult> {
  return sendWordPressPost(payload, "publish");
}
