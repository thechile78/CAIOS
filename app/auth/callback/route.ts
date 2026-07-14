import { NextResponse } from "next/server";

import { hasDatabaseConfiguration } from "@/lib/server-env";
import { createSupabaseServerClient } from "@/lib/supabase/server";

function safeNext(value: string | null): string {
  return value?.startsWith("/") && !value.startsWith("//") ? value : "/";
}

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get("code");
  const nextPath = safeNext(requestUrl.searchParams.get("next"));

  if (!hasDatabaseConfiguration() || !code) {
    return NextResponse.redirect(new URL("/login?error=callback_failed", requestUrl));
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) {
    return NextResponse.redirect(new URL("/login?error=callback_failed", requestUrl));
  }

  return NextResponse.redirect(new URL(nextPath, requestUrl));
}
