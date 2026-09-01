import "server-only";

import { getServerDatabaseEnvironment } from "@/lib/server-env";

interface TrustedMediaVerification {
  artifact_id: string;
  sha256: string;
  byte_size: number;
}

export async function finalizeTrustedMediaUpload(input: {
  authorizationId: string;
  actorId: string;
  verification: TrustedMediaVerification[];
}): Promise<void> {
  const environment = getServerDatabaseEnvironment();
  const headers: Record<string, string> = {
    apikey: environment.SUPABASE_SERVICE_ROLE_KEY,
    "content-type": "application/json",
  };
  if (!environment.SUPABASE_SERVICE_ROLE_KEY.startsWith("sb_secret_")) {
    headers.authorization = `Bearer ${environment.SUPABASE_SERVICE_ROLE_KEY}`;
  }
  const response = await fetch(
    `${environment.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/rpc/finalize_media_package_private_upload_verified`,
    {
      method: "POST",
      headers,
      body: JSON.stringify({
        p_authorization_id: input.authorizationId,
        p_actor: input.actorId,
        p_remote_verification: input.verification,
      }),
      cache: "no-store",
      redirect: "error",
    },
  );
  if (!response.ok) throw new Error(`Trusted media finalization failed (${response.status}).`);
}
