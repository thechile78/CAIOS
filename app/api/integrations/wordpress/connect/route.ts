import { NextRequest, NextResponse } from "next/server";

import { getCurrentProfile, roleCanAdminister } from "@/lib/auth";
import {
  buildWordPressAuthorizationUrl,
  createWordPressOAuthState,
} from "@/lib/wordpress-oauth";

export const dynamic = "force-dynamic";

function destination(request: NextRequest, path: string): URL {
  return new URL(path, request.url);
}

export async function GET(request: NextRequest) {
  const profile = await getCurrentProfile();
  if (!profile) {
    return NextResponse.redirect(
      destination(request, "/login?next=/integrations/wordpress"),
    );
  }
  if (!roleCanAdminister(profile.role)) {
    return NextResponse.redirect(destination(request, "/unauthorized"));
  }

  try {
    const state = createWordPressOAuthState(profile.id);
    const response = NextResponse.redirect(buildWordPressAuthorizationUrl(state));
    response.cookies.set("caios_wordpress_oauth_state", state, {
      httpOnly: true,
      secure: true,
      sameSite: "lax",
      maxAge: 10 * 60,
      path: "/api/integrations/wordpress",
    });
    return response;
  } catch (caught) {
    const url = destination(request, "/integrations/wordpress");
    url.searchParams.set(
      "error",
      caught instanceof Error
        ? caught.message
        : "WordPress connection could not start.",
    );
    return NextResponse.redirect(url);
  }
}
