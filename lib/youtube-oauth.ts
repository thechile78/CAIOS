import "server-only";

const GOOGLE_AUTHORIZATION_ENDPOINT = "https://accounts.google.com/o/oauth2/v2/auth";
const GOOGLE_TOKEN_ENDPOINT = "https://oauth2.googleapis.com/token";

export const YOUTUBE_SCOPES = [
  "openid",
  "email",
  "profile",
  "https://www.googleapis.com/auth/youtube.readonly",
  "https://www.googleapis.com/auth/youtube.upload",
] as const;

function requireVariable(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`Missing required environment variable: ${name}`);
  return value;
}

export function getYoutubeOAuthEnvironment() {
  return {
    clientId: requireVariable("GOOGLE_YOUTUBE_CLIENT_ID"),
    clientSecret: requireVariable("GOOGLE_YOUTUBE_CLIENT_SECRET"),
    redirectUri:
      process.env.GOOGLE_YOUTUBE_REDIRECT_URI?.trim() ||
      "https://caios.vercel.app/api/integrations/youtube/callback",
  };
}

export function buildYoutubeAuthorizationUrl(state: string): string {
  const environment = getYoutubeOAuthEnvironment();
  const url = new URL(GOOGLE_AUTHORIZATION_ENDPOINT);
  url.searchParams.set("client_id", environment.clientId);
  url.searchParams.set("redirect_uri", environment.redirectUri);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", YOUTUBE_SCOPES.join(" "));
  url.searchParams.set("access_type", "offline");
  url.searchParams.set("include_granted_scopes", "true");
  url.searchParams.set("prompt", "consent");
  url.searchParams.set("state", state);
  return url.toString();
}

export async function exchangeYoutubeAuthorizationCode(code: string) {
  const environment = getYoutubeOAuthEnvironment();
  const response = await fetch(GOOGLE_TOKEN_ENDPOINT, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: environment.clientId,
      client_secret: environment.clientSecret,
      redirect_uri: environment.redirectUri,
      grant_type: "authorization_code",
    }),
    cache: "no-store",
  });

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`Google token exchange failed (${response.status}): ${detail}`);
  }

  return (await response.json()) as {
    access_token: string;
    expires_in: number;
    refresh_token?: string;
    scope: string;
    token_type: string;
    id_token?: string;
  };
}
