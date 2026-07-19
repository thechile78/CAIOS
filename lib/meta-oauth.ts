import "server-only";

import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";

const REQUIRED_META_SCOPES = ["pages_show_list", "pages_read_engagement", "instagram_basic"] as const;
const FORBIDDEN_META_SCOPES = ["pages_manage_posts", "instagram_content_publish"] as const;
const META_REDIRECT_URI = "https://caios.vercel.app/api/integrations/meta/callback";

export const META_SCOPES = REQUIRED_META_SCOPES;

export function getMetaSystemUserToken(): string | null {
  return process.env.META_SYSTEM_USER_TOKEN?.trim() || null;
}

function requireVariable(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`Missing required environment variable: ${name}`);
  return value;
}

export function getMetaOAuthEnvironment() {
  const stateSecret = requireVariable("META_OAUTH_STATE_SECRET");
  if (Buffer.byteLength(stateSecret) < 32) {
    throw new Error("META_OAUTH_STATE_SECRET must contain at least 32 bytes.");
  }

  return {
    appId: requireVariable("META_APP_ID"),
    appSecret: requireVariable("META_APP_SECRET"),
    loginConfigId: requireVariable("META_LOGIN_CONFIG_ID"),
    stateSecret,
    graphVersion: process.env.META_GRAPH_API_VERSION?.trim() || "v21.0",
    expectedPageId: process.env.META_FACEBOOK_PAGE_ID?.trim() || "1214069685123391",
    expectedPageName: process.env.META_FACEBOOK_PAGE_NAME?.trim() || "Chilemaniacs",
    expectedInstagramId: process.env.META_INSTAGRAM_ACCOUNT_ID?.trim() || "17841403279084160",
    expectedInstagramUsername:
      process.env.META_INSTAGRAM_USERNAME?.trim().replace(/^@/, "") || "thechilepromotions",
    expectedInstagramAccountType:
      process.env.META_INSTAGRAM_EXPECTED_ACCOUNT_TYPE?.trim().toUpperCase() || "BUSINESS",
  };
}

interface OAuthStatePayload {
  nonce: string;
  userId: string;
  provider: "meta";
  redirectUri: string;
  expiresAt: number;
}

function stateSignature(encodedPayload: string, secret: string): string {
  return createHmac("sha256", secret).update(encodedPayload).digest("base64url");
}

export function createMetaOAuthState(userId: string): string {
  const environment = getMetaOAuthEnvironment();
  const payload: OAuthStatePayload = {
    nonce: randomBytes(32).toString("base64url"),
    userId,
    provider: "meta",
    redirectUri: META_REDIRECT_URI,
    expiresAt: Date.now() + 10 * 60 * 1000,
  };
  const encoded = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return `${encoded}.${stateSignature(encoded, environment.stateSecret)}`;
}

export function verifyMetaOAuthState(state: string, userId: string): OAuthStatePayload {
  const environment = getMetaOAuthEnvironment();
  const [encoded, suppliedSignature, extra] = state.split(".");
  if (!encoded || !suppliedSignature || extra) throw new Error("OAuth state is malformed.");

  const expectedSignature = stateSignature(encoded, environment.stateSecret);
  const supplied = Buffer.from(suppliedSignature);
  const expected = Buffer.from(expectedSignature);
  if (supplied.length !== expected.length || !timingSafeEqual(supplied, expected)) {
    throw new Error("OAuth state signature is invalid.");
  }

  let payload: OAuthStatePayload;
  try {
    payload = JSON.parse(Buffer.from(encoded, "base64url").toString("utf8")) as OAuthStatePayload;
  } catch {
    throw new Error("OAuth state payload is invalid.");
  }

  if (
    payload.provider !== "meta" ||
    payload.userId !== userId ||
    payload.redirectUri !== META_REDIRECT_URI ||
    !payload.nonce ||
    !Number.isFinite(payload.expiresAt) ||
    payload.expiresAt < Date.now()
  ) {
    throw new Error("OAuth state is expired or does not match this administrator.");
  }
  return payload;
}

export function buildMetaAuthorizationUrl(state: string): string {
  const environment = getMetaOAuthEnvironment();
  const url = new URL(`https://www.facebook.com/${environment.graphVersion}/dialog/oauth`);
  url.searchParams.set("client_id", environment.appId);
  url.searchParams.set("config_id", environment.loginConfigId);
  url.searchParams.set("redirect_uri", META_REDIRECT_URI);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", REQUIRED_META_SCOPES.join(","));
  url.searchParams.set("state", state);
  return url.toString();
}

interface MetaTokenResponse {
  access_token: string;
  token_type?: string;
  expires_in?: number;
}

async function graphJson<T>(url: URL, accessToken?: string): Promise<T> {
  const response = await fetch(url, {
    headers: accessToken ? { authorization: `Bearer ${accessToken}` } : undefined,
    cache: "no-store",
  });
  if (!response.ok) throw new Error(`Meta account verification failed (${response.status}).`);
  return (await response.json()) as T;
}

export async function exchangeMetaAuthorizationCode(code: string): Promise<MetaTokenResponse> {
  const environment = getMetaOAuthEnvironment();
  const url = new URL(`https://graph.facebook.com/${environment.graphVersion}/oauth/access_token`);
  const response = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: environment.appId,
      client_secret: environment.appSecret,
      redirect_uri: META_REDIRECT_URI,
      code,
    }),
    cache: "no-store",
  });
  if (!response.ok) throw new Error(`Meta authorization exchange failed (${response.status}).`);
  return (await response.json()) as MetaTokenResponse;
}

interface PermissionResponse {
  data?: Array<{ permission?: string; status?: string }>;
}

interface InstagramAccount {
  id: string;
  username?: string;
}

interface PageAccount {
  id: string;
  name?: string;
  access_token?: string;
  instagram_business_account?: InstagramAccount;
}

interface PageAccountsResponse {
  data?: PageAccount[];
  paging?: { next?: string };
}

export interface VerifiedMetaAccounts {
  page: { id: string; name: string };
  instagram: { id: string; username: string; accountType: string };
  pageAccessToken: string;
  expiresIn: number | null;
  scopes: string[];
}

function validatedPagingUrl(value: string): URL {
  const environment = getMetaOAuthEnvironment();
  const url = new URL(value);
  if (url.protocol !== "https:" || url.hostname !== "graph.facebook.com" || !url.pathname.startsWith(`/${environment.graphVersion}/`)) {
    throw new Error("Meta returned an unsafe pagination URL.");
  }
  return url;
}

export async function verifyMetaAccounts(tokens: MetaTokenResponse): Promise<VerifiedMetaAccounts> {
  if (!tokens.access_token) throw new Error("Meta did not return an access token.");
  const environment = getMetaOAuthEnvironment();
  const graphBase = `https://graph.facebook.com/${environment.graphVersion}`;
  const permissionsUrl = new URL(`${graphBase}/me/permissions`);
  const permissions = await graphJson<PermissionResponse>(permissionsUrl, tokens.access_token);
  const granted = new Set(
    (permissions.data ?? [])
      .filter((permission) => permission.status === "granted" && permission.permission)
      .map((permission) => permission.permission as string),
  );
  const missing = REQUIRED_META_SCOPES.filter((scope) => !granted.has(scope));
  const forbidden = FORBIDDEN_META_SCOPES.filter((scope) => granted.has(scope));
  if (missing.length) throw new Error(`Required read-only Meta permissions were not granted: ${missing.join(", ")}.`);
  if (forbidden.length) throw new Error("Publishing permissions are present. Remove them in Meta and reconnect with read-only access.");

  let accountsUrl: URL | null = new URL(`${graphBase}/me/accounts`);
  accountsUrl.searchParams.set("fields", "id,name,access_token,instagram_business_account{id,username}");
  accountsUrl.searchParams.set("limit", "100");
  let targetPage: PageAccount | undefined;
  while (accountsUrl) {
    const accounts: PageAccountsResponse = await graphJson<PageAccountsResponse>(accountsUrl, tokens.access_token);
    targetPage = accounts.data?.find((page) => page.id === environment.expectedPageId);
    if (targetPage) break;
    accountsUrl = accounts.paging?.next ? validatedPagingUrl(accounts.paging.next) : null;
  }

  if (!targetPage) {
    const selectedPageUrl = new URL(`${graphBase}/${encodeURIComponent(environment.expectedPageId)}`);
    selectedPageUrl.searchParams.set("fields", "id,name,instagram_business_account{id,username}");
    try {
      targetPage = await graphJson<PageAccount>(selectedPageUrl, tokens.access_token);
    } catch {
      throw new Error(`The authorized Meta user does not control the expected Page: ${environment.expectedPageName} (${environment.expectedPageId}).`);
    }
  }

  if (!targetPage) {
    throw new Error(`The authorized Meta user does not control the expected Page: ${environment.expectedPageName} (${environment.expectedPageId}).`);
  }
  if (targetPage.name !== environment.expectedPageName) {
    throw new Error(`Meta returned the expected Page ID with the wrong name: ${targetPage.name || "unnamed"}.`);
  }
  const readAccessToken = targetPage.access_token || tokens.access_token;
  const instagram = targetPage.instagram_business_account;
  if (!instagram) throw new Error("Chilemaniacs does not expose a linked Instagram professional account through Meta.");

  let verifiedInstagram = instagram;
  if (!instagram.username) {
    const instagramUrl = new URL(`${graphBase}/${encodeURIComponent(instagram.id)}`);
    instagramUrl.searchParams.set("fields", "id,username");
    verifiedInstagram = await graphJson<InstagramAccount>(instagramUrl, readAccessToken);
  }
  const username = verifiedInstagram.username?.replace(/^@/, "") ?? "";
  const accountType = "BUSINESS";
  if (verifiedInstagram.id !== environment.expectedInstagramId || username.toLowerCase() !== environment.expectedInstagramUsername.toLowerCase()) {
    throw new Error(`The Instagram account linked to Chilemaniacs is not the expected @${environment.expectedInstagramUsername} (${environment.expectedInstagramId}).`);
  }
  if (environment.expectedInstagramAccountType !== accountType) {
    throw new Error(`CAIOS only supports Meta's instagram_business_account relationship; expected type must be ${accountType}.`);
  }

  return {
    page: { id: targetPage.id, name: targetPage.name },
    instagram: { id: verifiedInstagram.id, username, accountType },
    pageAccessToken: readAccessToken,
    expiresIn: tokens.expires_in ?? null,
    scopes: [...REQUIRED_META_SCOPES],
  };
}
