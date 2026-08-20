import "server-only";

import { getServerDatabaseEnvironment } from "@/lib/server-env";
import { decryptSecret, encryptSecret } from "@/lib/social-token-vault";

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

export interface SearchConsoleConnection {
  propertyUri: string;
  permissionLevel: string;
  accessToken: string;
  refreshToken: string | null;
  accessTokenExpiresAt: string | null;
  scopes: string[];
  verifiedAt: string | null;
}

interface StoreSearchConsoleConnectionInput {
  actorId: string;
  propertyUri: string;
  permissionLevel: string;
  accessToken: string;
  refreshToken?: string;
  expiresIn: number;
  scopes: string[];
}

export async function storeSearchConsoleConnection(
  input: StoreSearchConsoleConnectionInput,
): Promise<void> {
  const environment = getServerDatabaseEnvironment();
  const endpoint = `${environment.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/search_console_connections?on_conflict=property_uri`;
  const response = await fetch(endpoint, {
    method: "POST",
    headers: vaultHeaders(
      environment.SUPABASE_SERVICE_ROLE_KEY,
      "resolution=merge-duplicates,return=minimal",
    ),
    body: JSON.stringify({
      property_uri: input.propertyUri,
      permission_level: input.permissionLevel,
      account_name: "Chilemaniacs",
      access_token_ciphertext: encryptSecret(input.accessToken),
      refresh_token_ciphertext: input.refreshToken ? encryptSecret(input.refreshToken) : null,
      access_token_expires_at: new Date(Date.now() + input.expiresIn * 1000).toISOString(),
      scopes: input.scopes,
      connected_by: input.actorId,
      verified_at: new Date().toISOString(),
      metadata: { verification: "search_console_sites_list" },
    }),
    cache: "no-store",
  });

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`Secure Search Console token storage failed (${response.status}): ${detail}`);
  }
}

export async function getSearchConsoleConnection(): Promise<SearchConsoleConnection | null> {
  const environment = getServerDatabaseEnvironment();
  const url = new URL(`${environment.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/search_console_connections`);
  url.searchParams.set(
    "select",
    "property_uri,permission_level,access_token_ciphertext,refresh_token_ciphertext,access_token_expires_at,scopes,verified_at",
  );
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

  return {
    propertyUri: String(row.property_uri),
    permissionLevel: String(row.permission_level),
    accessToken: decryptSecret(row.access_token_ciphertext),
    refreshToken:
      typeof row.refresh_token_ciphertext === "string"
        ? decryptSecret(row.refresh_token_ciphertext)
        : null,
    accessTokenExpiresAt:
      typeof row.access_token_expires_at === "string" ? row.access_token_expires_at : null,
    scopes: Array.isArray(row.scopes) ? row.scopes.map(String) : [],
    verifiedAt: typeof row.verified_at === "string" ? row.verified_at : null,
  };
}
