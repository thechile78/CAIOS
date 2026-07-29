import "server-only";

export interface WordPressPostResult {
  id: string;
  link: string | null;
  dryRun: boolean;
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
}

function encodeWordPressPost(
  payload: Record<string, unknown>,
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
  return body;
}

function getEndpoint(): URL {
  const site = required("CAIOS_WORDPRESS_SITE");
  return new URL(
    `https://public-api.wordpress.com/rest/v1.1/sites/${encodeURIComponent(site)}/posts/new/`,
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

async function sendWordPressPost(
  payload: unknown,
  expectedStatus: "draft" | "publish",
): Promise<WordPressPostResult> {
  if (!isWordPressDispatchEnabled()) throw new Error("WordPress draft dispatch is disabled");
  validateWordPressPostPayload(payload, expectedStatus);

  if (isWordPressDryRun()) {
    return { id: "dry-run", link: null, dryRun: true };
  }

  const accessToken = required("CAIOS_WORDPRESS_OAUTH_ACCESS_TOKEN");
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10_000);

  try {
    const body = encodeWordPressPost(payload, expectedStatus);
    const response = await fetch(getEndpoint(), {
      method: "POST",
      headers: {
        authorization: `Bearer ${accessToken}`,
        "content-type": "application/x-www-form-urlencoded",
        "user-agent": "CAIOS/5.1",
      },
      body,
      cache: "no-store",
      redirect: "error",
      signal: controller.signal,
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
  } finally {
    clearTimeout(timeout);
  }
}

export async function sendWordPressDraft(payload: unknown): Promise<WordPressPostResult> {
  return sendWordPressPost(payload, "draft");
}

export async function publishWordPressPost(payload: unknown): Promise<WordPressPostResult> {
  return sendWordPressPost(payload, "publish");
}
