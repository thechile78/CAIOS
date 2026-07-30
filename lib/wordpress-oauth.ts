import "server-only";

import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";

export const WORDPRESS_REQUIRED_SCOPES = ["posts", "media"] as const;
export const WORDPRESS_REDIRECT_URI =
  "https://caios.vercel.app/api/integrations/wordpress/callback";

function requireVariable(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`Missing required environment variable: ${name}`);
  return value;
}

function getWordPressClientId(): string {
  return process.env.CAIOS_WORDPRESS_OAUTH_CLIENT_ID?.trim() || "144644";
}

export function getWordPressOAuthEnvironment() {
  return {
    clientId: getWordPressClientId(),
    clientSecret: requireVariable("CAIOS_WORDPRESS_OAUTH_CLIENT_SECRET"),
    stateSecret:
      process.env.CAIOS_WORDPRESS_OAUTH_STATE_SECRET?.trim() ||
      requireVariable("SOCIAL_TOKEN_ENCRYPTION_KEY"),
    site: requireVariable("CAIOS_WORDPRESS_SITE"),
  };
}

interface WordPressOAuthState {
  nonce: string;
  userId: string;
  provider: "wordpress";
  redirectUri: string;
  expiresAt: number;
}

function signature(payload: string, secret: string): string {
  return createHmac("sha256", secret).update(payload).digest("base64url");
}

export function createWordPressOAuthState(userId: string): string {
  const environment = getWordPressOAuthEnvironment();
  const payload: WordPressOAuthState = {
    nonce: randomBytes(32).toString("base64url"),
    userId,
    provider: "wordpress",
    redirectUri: WORDPRESS_REDIRECT_URI,
    expiresAt: Date.now() + 10 * 60 * 1000,
  };
  const encoded = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return `${encoded}.${signature(encoded, environment.stateSecret)}`;
}

export function verifyWordPressOAuthState(
  state: string,
  userId: string,
): WordPressOAuthState {
  const environment = getWordPressOAuthEnvironment();
  const [encoded, suppliedSignature, extra] = state.split(".");
  if (!encoded || !suppliedSignature || extra) {
    throw new Error("WordPress authorization state is malformed.");
  }
  const expectedSignature = signature(encoded, environment.stateSecret);
  const supplied = Buffer.from(suppliedSignature);
  const expected = Buffer.from(expectedSignature);
  if (supplied.length !== expected.length || !timingSafeEqual(supplied, expected)) {
    throw new Error("WordPress authorization state is invalid.");
  }
  let payload: WordPressOAuthState;
  try {
    payload = JSON.parse(
      Buffer.from(encoded, "base64url").toString("utf8"),
    ) as WordPressOAuthState;
  } catch {
    throw new Error("WordPress authorization state is invalid.");
  }
  if (
    payload.provider !== "wordpress" ||
    payload.userId !== userId ||
    payload.redirectUri !== WORDPRESS_REDIRECT_URI ||
    !payload.nonce ||
    payload.expiresAt < Date.now()
  ) {
    throw new Error("WordPress authorization state expired or belongs to another administrator.");
  }
  return payload;
}

export function buildWordPressAuthorizationUrl(state: string): string {
  const environment = getWordPressOAuthEnvironment();
  const url = new URL("https://public-api.wordpress.com/oauth2/authorize");
  url.searchParams.set("client_id", environment.clientId);
  url.searchParams.set("redirect_uri", WORDPRESS_REDIRECT_URI);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", WORDPRESS_REQUIRED_SCOPES.join(" "));
  url.searchParams.set("blog", environment.site);
  url.searchParams.set("state", state);
  return url.toString();
}

interface WordPressTokenResponse {
  access_token?: string;
  blog_id?: string | number;
  blog_url?: string;
  scope?: string;
  token_type?: string;
}

export interface VerifiedWordPressToken {
  accessToken: string;
  blogId: string;
  blogUrl: string;
  scopes: string[];
}

function scopesFrom(value: string | undefined): string[] {
  return (value ?? "")
    .split(/[\s,]+/)
    .map((scope) => scope.trim())
    .filter(Boolean);
}

export function assertWordPressScopes(scopes: readonly string[]): void {
  const granted = new Set(scopes);
  const missing = WORDPRESS_REQUIRED_SCOPES.filter((scope) => !granted.has(scope));
  if (missing.length) {
    throw new Error(
      `WordPress connection is missing required permission: ${missing.join(", ")}.`,
    );
  }
}

export async function inspectWordPressToken(
  accessToken: string,
): Promise<VerifiedWordPressToken> {
  const url = new URL("https://public-api.wordpress.com/oauth2/token-info");
  url.searchParams.set("client_id", getWordPressClientId());
  url.searchParams.set("token", accessToken);
  const response = await fetch(url, {
    cache: "no-store",
    redirect: "error",
    signal: AbortSignal.timeout(10_000),
  });
  if (!response.ok) {
    throw new Error("WordPress connection could not be verified. Reconnect WordPress.");
  }
  const token = (await response.json()) as WordPressTokenResponse;
  const scopes = scopesFrom(token.scope);
  assertWordPressScopes(scopes);
  if (!token.blog_id || !token.blog_url) {
    throw new Error("WordPress did not identify the authorized site.");
  }
  return {
    accessToken,
    blogId: String(token.blog_id),
    blogUrl: token.blog_url,
    scopes,
  };
}

export async function exchangeWordPressAuthorizationCode(
  code: string,
): Promise<VerifiedWordPressToken> {
  const environment = getWordPressOAuthEnvironment();
  const response = await fetch("https://public-api.wordpress.com/oauth2/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: environment.clientId,
      client_secret: environment.clientSecret,
      redirect_uri: WORDPRESS_REDIRECT_URI,
      code,
      grant_type: "authorization_code",
    }),
    cache: "no-store",
    redirect: "error",
    signal: AbortSignal.timeout(10_000),
  });
  if (!response.ok) {
    throw new Error(`WordPress authorization exchange failed (${response.status}).`);
  }
  const token = (await response.json()) as WordPressTokenResponse;
  if (!token.access_token) throw new Error("WordPress did not return an access token.");
  return inspectWordPressToken(token.access_token);
}
