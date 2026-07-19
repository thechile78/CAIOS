import { NextRequest, NextResponse } from "next/server";

import { getCurrentProfile, roleCanAdminister } from "@/lib/auth";
import { buildMetaAuthorizationUrl, createMetaOAuthState } from "@/lib/meta-oauth";

export const dynamic = "force-dynamic";

function destination(request: NextRequest, path: string): URL {
  return new URL(path, request.url);
}

export async function GET(request: NextRequest) {
  const profile = await getCurrentProfile();
  if (!profile) return NextResponse.redirect(destination(request, "/login?next=/integrations/meta"));
  if (!roleCanAdminister(profile.role)) return NextResponse.redirect(destination(request, "/unauthorized"));

  try {
    const state = createMetaOAuthState(profile.id);
    const response = NextResponse.redirect(buildMetaAuthorizationUrl(state));
    response.cookies.set("caios_meta_oauth_state", state, {
      httpOnly: true,
      secure: true,
      sameSite: "lax",
      maxAge: 10 * 60,
      path: "/api/integrations/meta",
    });
    return response;
  } catch {
    const url = destination(request, "/integrations/meta");
    url.searchParams.set("error", "Meta OAuth is not fully configured on the server.");
    return NextResponse.redirect(url);
  }
}
