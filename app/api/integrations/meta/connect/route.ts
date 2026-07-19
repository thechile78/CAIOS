import { NextRequest, NextResponse } from "next/server";

import { getCurrentProfile, roleCanAdminister } from "@/lib/auth";
import {
  buildMetaAuthorizationUrl,
  createMetaOAuthState,
  getMetaSystemUserToken,
  verifyMetaAccounts,
} from "@/lib/meta-oauth";
import { storeMetaConnections } from "@/lib/social-token-vault";

export const dynamic = "force-dynamic";

function destination(request: NextRequest, path: string): URL {
  return new URL(path, request.url);
}

export async function GET(request: NextRequest) {
  const profile = await getCurrentProfile();
  if (!profile) return NextResponse.redirect(destination(request, "/login?next=/integrations/meta"));
  if (!roleCanAdminister(profile.role)) return NextResponse.redirect(destination(request, "/unauthorized"));

  try {
    const systemUserToken = getMetaSystemUserToken();
    if (systemUserToken) {
      const verified = await verifyMetaAccounts({ access_token: systemUserToken });
      await storeMetaConnections({ actorId: profile.id, ...verified });
      const url = destination(request, "/integrations/meta");
      url.searchParams.set("connected", "1");
      return NextResponse.redirect(url);
    }

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
  } catch (caught) {
    const url = destination(request, "/integrations/meta");
    const message = caught instanceof Error ? caught.message : "Meta connection failed safely.";
    url.searchParams.set("error", message);
    return NextResponse.redirect(url);
  }
}
