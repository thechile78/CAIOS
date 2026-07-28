import "server-only";

export interface WordPressDraftResult {
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

export function validateWordPressDraftPayload(payload: unknown): asserts payload is Record<string, unknown> {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) throw new Error("invalid draft payload");
  const record = payload as Record<string, unknown>;
  if (record.status !== "draft") throw new Error("WordPress status must remain draft");
  for (const forbidden of ["date", "date_gmt", "password", "author"]) {
    if (forbidden in record) throw new Error(`prohibited WordPress field: ${forbidden}`);
  }
}

function getEndpoint(): URL {
  const site = required("CAIOS_WORDPRESS_SITE");
  return new URL(
    `https://public-api.wordpress.com/rest/v1.1/sites/${encodeURIComponent(site)}/posts/new`,
  );
}

export async function sendWordPressDraft(payload: unknown): Promise<WordPressDraftResult> {
  if (!isWordPressDispatchEnabled()) throw new Error("WordPress draft dispatch is disabled");
  validateWordPressDraftPayload(payload);

  if (isWordPressDryRun()) {
    return { id: "dry-run", link: null, dryRun: true };
  }

  const accessToken = required("CAIOS_WORDPRESS_OAUTH_ACCESS_TOKEN");
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10_000);

  try {
    const response = await fetch(getEndpoint(), {
      method: "POST",
      headers: {
        authorization: `Bearer ${accessToken}`,
        "content-type": "application/json",
        "user-agent": "CAIOS/5.1",
      },
      body: JSON.stringify({ ...payload, status: "draft", publicize: false }),
      cache: "no-store",
      redirect: "error",
      signal: controller.signal,
    });

    if (!response.ok) throw new Error(`WordPress draft request failed with HTTP ${response.status}`);
    const body = (await response.json()) as {
      ID?: number | string;
      URL?: string;
      status?: string;
    };
    if (body.ID === undefined) throw new Error("WordPress response did not include a post id");
    if (body.status !== "draft") {
      throw new Error("WordPress did not confirm draft status");
    }
    return {
      id: String(body.ID),
      link: typeof body.URL === "string" ? body.URL : null,
      dryRun: false,
    };
  } finally {
    clearTimeout(timeout);
  }
}
