import "server-only";

import { createCipheriv, randomBytes } from "node:crypto";

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

export function encryptSecret(value: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", encryptionKey(), iv);
  const ciphertext = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return ["v1", iv.toString("base64url"), tag.toString("base64url"), ciphertext.toString("base64url")].join(".");
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
  const supabaseUrl = requireVariable("NEXT_PUBLIC_SUPABASE_URL");
  const serviceRoleKey = requireVariable("SUPABASE_SERVICE_ROLE_KEY");
  const response = await fetch(`${supabaseUrl}/rest/v1/social_oauth_connections?on_conflict=provider,provider_account_id`, {
    method: "POST",
    headers: {
      apikey: serviceRoleKey,
      authorization: `Bearer ${serviceRoleKey}`,
      "content-type": "application/json",
      prefer: "resolution=merge-duplicates,return=minimal",
    },
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
