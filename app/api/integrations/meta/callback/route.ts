import { NextRequest, NextResponse } from "next/server";

import { getCurrentProfile, roleCanAdminister } from "@/lib/auth";
import {
  exchangeMetaAuthorizationCode,
  verifyMetaAccounts,
  verifyMetaOAuthState,
} from "@/lib/meta-oauth";
import { storeMetaConnections } from "@/lib/social-token-vault";

export const dynamic = "force-dynamic";

function redirectAndConsumeState(request: NextRequest, params: Record<string, string>): NextResponse {
  const destination = new URL("/integrations/meta", request.url);
  for (const [key, value] of Object.entries(params)) destination.searchParams.set(key, value);
  const response = NextResponse.redirect(destination);
  response.cookies.delete({ name: "caios_meta_oauth_state", path: "/api/integrations/meta" });
  return response;
}

export async function GET(request: NextRequest) {
  const profile = await getCurrentProfile();
  if (!profile) return redirectAndConsumeState(request, { error: "Sign in again before connecting Meta." });
  if (!roleCanAdminister(profile.role)) return redirectAndConsumeState(request, { error: "Administrator access is required." });
  if (request.nextUrl.searchParams.has("error")) {
    return redirectAndConsumeState(request, { error: "Meta authorization was denied or cancelled. Nothing was connected." });
  }

  const code = request.nextUrl.searchParams.get("code");
  const state = request.nextUrl.searchParams.get("state");
  const expectedState = request.cookies.get("caios_meta_oauth_state")?.value;
  if (!code || !state || !expectedState || state !== expectedState) {
    return redirectAndConsumeState(request, { error: "OAuth state validation failed. Start the connection again." });
  }

  try {
    verifyMetaOAuthState(state, profile.id);
    const tokens = await exchangeMetaAuthorizationCode(code);
    const verified = await verifyMetaAccounts(tokens);
    await storeMetaConnections({ actorId: profile.id, ...verified });
    return redirectAndConsumeState(request, { connected: "1" });
  } catch (caught) {
    const message = caught instanceof Error ? caught.message : "Meta connection failed safely.";
    return redirectAndConsumeState(request, { error: message });
  }
}
