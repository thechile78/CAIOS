import { randomBytes } from "node:crypto";

import { NextRequest, NextResponse } from "next/server";

import { getCurrentProfile, roleCanAdminister } from "@/lib/auth";
import { buildSearchConsoleAuthorizationUrl } from "@/lib/search-console-oauth";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const profile = await getCurrentProfile();
  if (!profile) {
    return NextResponse.redirect(new URL("/login", request.url));
  }
  if (!roleCanAdminister(profile.role)) {
    return NextResponse.redirect(new URL("/unauthorized", request.url));
  }

  try {
    const state = randomBytes(32).toString("hex");
    const redirectUri = `${request.nextUrl.origin}/api/integrations/search-console/callback`;
    const response = NextResponse.redirect(
      buildSearchConsoleAuthorizationUrl(state, redirectUri),
    );
    response.cookies.set("caios_search_console_oauth_state", state, {
      httpOnly: true,
      secure: true,
      sameSite: "lax",
      maxAge: 10 * 60,
      path: "/",
    });
    return response;
  } catch (error) {
    const message = error instanceof Error ? error.message : "Search Console OAuth is not configured.";
    const url = new URL("/", request.url);
    url.searchParams.set("searchConsoleError", message);
    return NextResponse.redirect(url);
  }
}
