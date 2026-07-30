import { NextRequest, NextResponse } from "next/server";

import { getCurrentProfile, roleCanAdminister } from "@/lib/auth";
import { storeWordPressConnection } from "@/lib/social-token-vault";
import {
  exchangeWordPressAuthorizationCode,
  verifyWordPressOAuthState,
} from "@/lib/wordpress-oauth";

export const dynamic = "force-dynamic";

function redirectAndConsumeState(
  request: NextRequest,
  params: Record<string, string>,
): NextResponse {
  const destination = new URL("/integrations/wordpress", request.url);
  for (const [key, value] of Object.entries(params)) {
    destination.searchParams.set(key, value);
  }
  const response = NextResponse.redirect(destination);
  response.cookies.delete({
    name: "caios_wordpress_oauth_state",
    path: "/api/integrations/wordpress",
  });
  return response;
}

export async function GET(request: NextRequest) {
  const profile = await getCurrentProfile();
  if (!profile) {
    return redirectAndConsumeState(request, {
      error: "Sign in to CAIOS and start the WordPress connection again.",
    });
  }
  if (!roleCanAdminister(profile.role)) {
    return redirectAndConsumeState(request, {
      error: "Administrator access is required to connect WordPress.",
    });
  }

  const error = request.nextUrl.searchParams.get("error");
  const code = request.nextUrl.searchParams.get("code");
  const state = request.nextUrl.searchParams.get("state");
  const expectedState = request.cookies.get("caios_wordpress_oauth_state")?.value;
  if (error) return redirectAndConsumeState(request, { error });
  if (!code || !state || !expectedState || state !== expectedState) {
    return redirectAndConsumeState(request, {
      error: "WordPress authorization state is invalid. Start the connection again.",
    });
  }

  try {
    verifyWordPressOAuthState(state, profile.id);
    const verified = await exchangeWordPressAuthorizationCode(code);
    await storeWordPressConnection({ actorId: profile.id, ...verified });
    return redirectAndConsumeState(request, { connected: "1" });
  } catch (caught) {
    return redirectAndConsumeState(request, {
      error:
        caught instanceof Error
          ? caught.message
          : "WordPress connection failed safely.",
    });
  }
}
