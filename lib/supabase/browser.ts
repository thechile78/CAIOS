"use client";

import { createBrowserClient } from "@supabase/ssr";

import { getPublicDatabaseEnvironment } from "@/lib/server-env";

let browserClient: ReturnType<typeof createBrowserClient> | undefined;

export function createSupabaseBrowserClient() {
  if (!browserClient) {
    const environment = getPublicDatabaseEnvironment();
    browserClient = createBrowserClient(
      environment.NEXT_PUBLIC_SUPABASE_URL,
      environment.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    );
  }

  return browserClient;
}
