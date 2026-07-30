import "server-only";

import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

import { getServerDatabaseEnvironment } from "@/lib/server-env";

function requireVariable(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`Missing required environment variable: ${name}`);
  return value;
}

function encryptionKey(): Buffer {
  const key = Buffer.from(requireVariable("SOCIAL_TOKEN_ENCRYPTION_KEY"), "base64");
  if (key.length !== 32) {
    throw new Error("SOCIAL_TOKEN_ENCRYPTION_KEY must be a base64-encoded 32-byte key.");
  }
  return key;
}

function vaultHeaders(serviceRoleKey: string, prefer?: string): Record<string, string> {
  const headers: Record<string, string> = {
    apikey: serviceRoleKey,
    "content-type": "application/json",
    ...(prefer ? { prefer } : {}),
  };
  if (!serviceRoleKey.startsWith("sb_secret_")) {
    headers.authorization = `Bearer ${serviceRoleKey}`;
  }
  return headers;
}

export function encryptSecret(value: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", encryptionKey(), iv);
  const ciphertext = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return ["v1", iv.toString("base64url"), tag.toString("base64url"), ciphertext.toString("base64url")].join(".");
}

export function decryptSecret(value: string): string {
  const [version, encodedIv, encodedTag, encodedCiphertext, extra] = value.split(".");
  if (version !== "v1" || !encodedIv || !encodedTag || !encodedCiphertext || extra) {
    throw new Error("Encrypted credential has an unsupported format.");
  }

  try {
    const decipher = createDecipheriv(
      "aes-256-gcm",
      encryptionKey(),
      Buffer.from(encodedIv, "base64url"),
    );
    decipher.setAuthTag(Buffer.from(encodedTag, "base64url"));
    return Buffer.concat([
      decipher.update(Buffer.from(encodedCiphertext, "base64url")),
      decipher.final(),
    ]).toString("utf8");
  } catch {
    throw new Error("Encrypted credential could not be decrypted.");
  }
}

interface StoreWordPressConnectionInput {
  actorId: string;
  blogId: string;
  blogUrl: string;
  accessToken: string;
  scopes: string[];
}

export async function storeWordPressConnection(
  input: StoreWordPressConnectionInput,
): Promise<void> {
  const environment = getServerDatabaseEnvironment();
  const endpoint = `${environment.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/social_oauth_connections`;
  const lookup = new URL(endpoint);
  lookup.searchParams.set("select", "id");
  lookup.searchParams.set("provider", "eq.wordpress");
  lookup.searchParams.set("limit", "1");
  const lookupResponse = await fetch(lookup, {
    headers: vaultHeaders(environment.SUPABASE_SERVICE_ROLE_KEY),
    cache: "no-store",
  });
  if (!lookupResponse.ok) {
    throw new Error(`Secure WordPress connection lookup failed (${lookupResponse.status}).`);
  }
  const existing = (await lookupResponse.json()) as Array<{ id?: string }>;
  const row = {
    provider: "wordpress",
    provider_account_id: input.blogId,
    account_name: input.blogUrl,
    access_token_ciphertext: encryptSecret(input.accessToken),
    refresh_token_ciphertext: null,
    access_token_expires_at: null,
    scopes: input.scopes,
    metadata: { blog_url: input.blogUrl, verification: "wordpress_token_info" },
    connected_by: input.actorId,
    verified_at: new Date().toISOString(),
    publishing_enabled: true,
    scheduling_enabled: false,
    auto_post_enabled: false,
    auto_approval_enabled: false,
    approval_required: true,
  };
  const existingId = existing[0]?.id;
  const response = await fetch(
    existingId ? `${endpoint}?id=eq.${encodeURIComponent(existingId)}` : endpoint,
    {
      method: existingId ? "PATCH" : "POST",
      headers: vaultHeaders(environment.SUPABASE_SERVICE_ROLE_KEY, "return=minimal"),
      body: JSON.stringify(row),
      cache: "no-store",
    },
  );
  if (!response.ok) {
    throw new Error(`Secure WordPress token storage failed (${response.status}).`);
  }

  const auditResponse = await fetch(`${environment.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/audit_events`, {
    method: "POST",
    headers: vaultHeaders(environment.SUPABASE_SERVICE_ROLE_KEY, "return=minimal"),
    body: JSON.stringify({
      actor_id: input.actorId,
      event_type: "wordpress_connection_verified",
      event_data: {
        blog_id: input.blogId,
        blog_url: input.blogUrl,
        scopes: input.scopes,
        approval_required: true,
        scheduling_enabled: false,
        auto_post_enabled: false,
      },
    }),
    cache: "no-store",
  });
  if (!auditResponse.ok) {
    throw new Error(`WordPress connection audit write failed (${auditResponse.status}).`);
  }
}

export interface WordPressConnection {
  accessToken: string;
  blogId: string;
  blogUrl: string;
  scopes: string[];
  verifiedAt: string | null;
}

export async function getWordPressConnection(): Promise<WordPressConnection | null> {
  const environment = getServerDatabaseEnvironment();
  const url = new URL(`${environment.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/social_oauth_connections`);
  url.searchParams.set(
    "select",
    "provider_account_id,account_name,access_token_ciphertext,scopes,metadata,verified_at",
  );
  url.searchParams.set("provider", "eq.wordpress");
  url.searchParams.set("publishing_enabled", "eq.true");
  url.searchParams.set("approval_required", "eq.true");
  url.searchParams.set("order", "verified_at.desc");
  url.searchParams.set("limit", "1");
  const response = await fetch(url, {
    headers: vaultHeaders(environment.SUPABASE_SERVICE_ROLE_KEY),
    cache: "no-store",
  });
  if (!response.ok) return null;
  const rows = (await response.json()) as Array<Record<string, unknown>>;
  const row = rows[0];
  if (!row || typeof row.access_token_ciphertext !== "string") return null;
  const metadata = (row.metadata ?? {}) as Record<string, unknown>;
  return {
    accessToken: decryptSecret(row.access_token_ciphertext),
    blogId: String(row.provider_account_id),
    blogUrl:
      typeof metadata.blog_url === "string"
        ? metadata.blog_url
        : String(row.account_name),
    scopes: Array.isArray(row.scopes) ? row.scopes.map(String) : [],
    verifiedAt: typeof row.verified_at === "string" ? row.verified_at : null,
  };
}

export async function getWordPressConnectionSummary(): Promise<
  Omit<WordPressConnection, "accessToken"> | null
> {
  const environment = getServerDatabaseEnvironment();
  const url = new URL(`${environment.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/social_oauth_connections`);
  url.searchParams.set(
    "select",
    "provider_account_id,account_name,scopes,metadata,verified_at",
  );
  url.searchParams.set("provider", "eq.wordpress");
  url.searchParams.set("publishing_enabled", "eq.true");
  url.searchParams.set("approval_required", "eq.true");
  url.searchParams.set("order", "verified_at.desc");
  url.searchParams.set("limit", "1");
  const response = await fetch(url, {
    headers: vaultHeaders(environment.SUPABASE_SERVICE_ROLE_KEY),
    cache: "no-store",
  });
  if (!response.ok) return null;
  const rows = (await response.json()) as Array<Record<string, unknown>>;
  const row = rows[0];
  if (!row) return null;
  const metadata = (row.metadata ?? {}) as Record<string, unknown>;
  return {
    blogId: String(row.provider_account_id),
    blogUrl:
      typeof metadata.blog_url === "string"
        ? metadata.blog_url
        : String(row.account_name),
    scopes: Array.isArray(row.scopes) ? row.scopes.map(String) : [],
    verifiedAt: typeof row.verified_at === "string" ? row.verified_at : null,
  };
}

interface StoreYoutubeConnectionInput {
  channelId: string;
  channelName: string;
  accessToken: string;
  refreshToken?: string;
  expiresIn: number;
  scopes: string[];
  metadata?: Record<string, unknown>;
}

export async function storeYoutubeConnection(input: StoreYoutubeConnectionInput): Promise<void> {
  const environment = getServerDatabaseEnvironment();
  const supabaseUrl = environment.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = environment.SUPABASE_SERVICE_ROLE_KEY;
  const response = await fetch(`${supabaseUrl}/rest/v1/social_oauth_connections?on_conflict=provider,provider_account_id`, {
    method: "POST",
    headers: vaultHeaders(serviceRoleKey, "resolution=merge-duplicates,return=minimal"),
    body: JSON.stringify({
      provider: "youtube",
      provider_account_id: input.channelId,
      account_name: input.channelName,
      access_token_ciphertext: encryptSecret(input.accessToken),
      refresh_token_ciphertext: input.refreshToken ? encryptSecret(input.refreshToken) : null,
      access_token_expires_at: new Date(Date.now() + input.expiresIn * 1000).toISOString(),
      scopes: input.scopes,
      metadata: input.metadata ?? {},
    }),
    cache: "no-store",
  });

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`Secure token storage failed (${response.status}): ${detail}`);
  }
}

interface StoreMetaConnectionsInput {
  actorId: string;
  page: { id: string; name: string };
  instagram: { id: string; username: string; accountType: string };
  pageAccessToken: string;
  expiresIn: number | null;
  scopes: string[];
}

export async function storeMetaConnections(input: StoreMetaConnectionsInput): Promise<void> {
  const environment = getServerDatabaseEnvironment();
  const expiresAt = input.expiresIn
    ? new Date(Date.now() + input.expiresIn * 1000).toISOString()
    : null;
  const common = {
    access_token_ciphertext: encryptSecret(input.pageAccessToken),
    refresh_token_ciphertext: null,
    access_token_expires_at: expiresAt,
    scopes: input.scopes,
    connected_by: input.actorId,
    verified_at: new Date().toISOString(),
    publishing_enabled: false,
    scheduling_enabled: false,
    auto_post_enabled: false,
    auto_approval_enabled: false,
    approval_required: true,
  };
  const rows = [
    {
      ...common,
      provider: "facebook",
      provider_account_id: input.page.id,
      account_name: input.page.name,
      metadata: {
        linked_instagram_account_id: input.instagram.id,
        verification: "meta_graph_api",
      },
    },
    {
      ...common,
      access_token_ciphertext: encryptSecret(input.pageAccessToken),
      provider: "instagram",
      provider_account_id: input.instagram.id,
      account_name: `@${input.instagram.username}`,
      metadata: {
        linked_facebook_page_id: input.page.id,
        account_type: input.instagram.accountType,
        verification: "meta_graph_api",
      },
    },
  ];
  const response = await fetch(
    `${environment.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/social_oauth_connections?on_conflict=provider,provider_account_id`,
    {
      method: "POST",
      headers: vaultHeaders(environment.SUPABASE_SERVICE_ROLE_KEY, "resolution=merge-duplicates,return=minimal"),
      body: JSON.stringify(rows),
      cache: "no-store",
    },
  );
  if (!response.ok) throw new Error(`Secure Meta token storage failed (${response.status}).`);

  const auditResponse = await fetch(`${environment.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/audit_events`, {
    method: "POST",
    headers: vaultHeaders(environment.SUPABASE_SERVICE_ROLE_KEY, "return=minimal"),
    body: JSON.stringify({
      actor_id: input.actorId,
      event_type: "meta_accounts_connected_read_only",
      event_data: {
        facebook_page_id: input.page.id,
        instagram_account_id: input.instagram.id,
        approval_required: true,
        publishing_enabled: false,
        scheduling_enabled: false,
        auto_post_enabled: false,
        auto_approval_enabled: false,
      },
    }),
    cache: "no-store",
  });
  if (!auditResponse.ok) throw new Error(`Meta connection audit write failed (${auditResponse.status}).`);
}

export interface MetaConnectionSummary {
  provider: "facebook" | "instagram";
  providerAccountId: string;
  accountName: string;
  scopes: string[];
  metadata: Record<string, unknown>;
  verifiedAt: string | null;
  publishingEnabled: boolean;
  schedulingEnabled: boolean;
  autoPostEnabled: boolean;
  autoApprovalEnabled: boolean;
  approvalRequired: boolean;
}

export async function getMetaConnectionSummary(): Promise<MetaConnectionSummary[]> {
  const environment = getServerDatabaseEnvironment();
  const columns = [
    "provider",
    "provider_account_id",
    "account_name",
    "scopes",
    "metadata",
    "verified_at",
    "publishing_enabled",
    "scheduling_enabled",
    "auto_post_enabled",
    "auto_approval_enabled",
    "approval_required",
  ].join(",");
  const url = new URL(`${environment.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/social_oauth_connections`);
  url.searchParams.set("select", columns);
  url.searchParams.set("provider", "in.(facebook,instagram)");
  url.searchParams.set("order", "provider.asc");
  const response = await fetch(url, {
    headers: vaultHeaders(environment.SUPABASE_SERVICE_ROLE_KEY),
    cache: "no-store",
  });
  if (!response.ok) return [];
  const rows = (await response.json()) as Array<Record<string, unknown>>;
  return rows.map((row) => ({
    provider: row.provider as "facebook" | "instagram",
    providerAccountId: String(row.provider_account_id),
    accountName: String(row.account_name),
    scopes: Array.isArray(row.scopes) ? row.scopes.map(String) : [],
    metadata: (row.metadata ?? {}) as Record<string, unknown>,
    verifiedAt: typeof row.verified_at === "string" ? row.verified_at : null,
    publishingEnabled: row.publishing_enabled === true,
    schedulingEnabled: row.scheduling_enabled === true,
    autoPostEnabled: row.auto_post_enabled === true,
    autoApprovalEnabled: row.auto_approval_enabled === true,
    approvalRequired: row.approval_required === true,
  }));
}
