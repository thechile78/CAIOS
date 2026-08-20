import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";

import { getCurrentProfile, roleCanAdminister } from "@/lib/auth";
import { exchangeSearchConsoleAuthorizationCode } from "@/lib/search-console-oauth";
import { storeSearchConsoleConnection } from "@/lib/search-console-store";

export const dynamic = "force-dynamic";

interface SearchConsoleSitesResponse {
  siteEntry?: Array<{
    siteUrl?: string;
    permissionLevel?: string;
  }>;
}

function chooseChilemaniacsProperty(entries: SearchConsoleSitesResponse["siteEntry"]) {
  if (!entries?.length) return null;
  return (
    entries.find((entry) => entry.siteUrl === "sc-domain:chilemaniacs.com") ??
    entries.find((entry) => {
      const value = entry.siteUrl ?? "";
      return value.includes("chilemaniacs.com");
    }) ??
    null
  );
}

export async function GET(request: NextRequest) {
  const destination = new URL("/", request.url);
  const profile = await getCurrentProfile();
  if (!profile) {
    return NextResponse.redirect(new URL("/login", request.url));
  }
  if (!roleCanAdminister(profile.role)) {
    return NextResponse.redirect(new URL("/unauthorized", request.url));
  }

  const oauthError = request.nextUrl.searchParams.get("error");
  const code = request.nextUrl.searchParams.get("code");
  const state = request.nextUrl.searchParams.get("state");
  const cookieStore = await cookies();
  const expectedState = cookieStore.get("caios_search_console_oauth_state")?.value;

  if (oauthError) {
    destination.searchParams.set("searchConsoleError", oauthError);
    return NextResponse.redirect(destination);
  }

  if (!code || !state || !expectedState || state !== expectedState) {
    destination.searchParams.set(
      "searchConsoleError",
      "OAuth state validation failed. Start the Search Console connection again.",
    );
    return NextResponse.redirect(destination);
  }

  try {
    const redirectUri = `${request.nextUrl.origin}/api/integrations/search-console/callback`;
    const tokens = await exchangeSearchConsoleAuthorizationCode(code, redirectUri);

    const sitesResponse = await fetch("https://www.googleapis.com/webmasters/v3/sites", {
      headers: { authorization: `Bearer ${tokens.access_token}` },
      cache: "no-store",
    });
    if (!sitesResponse.ok) {
      const detail = await sitesResponse.text();
      throw new Error(`Search Console property verification failed (${sitesResponse.status}): ${detail}`);
    }

    const sites = (await sitesResponse.json()) as SearchConsoleSitesResponse;
    const property = chooseChilemaniacsProperty(sites.siteEntry);
    if (!property?.siteUrl) {
      throw new Error(
        "Google authorized successfully, but no Chilemaniacs Search Console property was available to this account.",
      );
    }

    await storeSearchConsoleConnection({
      actorId: profile.id,
      propertyUri: property.siteUrl,
      permissionLevel: property.permissionLevel ?? "unknown",
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token,
      expiresIn: tokens.expires_in,
      scopes: (tokens.scope ?? "https://www.googleapis.com/auth/webmasters.readonly")
        .split(" ")
        .filter(Boolean),
    });

    destination.searchParams.set("searchConsoleConnected", "1");
    destination.searchParams.set("searchConsoleProperty", property.siteUrl);

    const response = NextResponse.redirect(destination);
    response.cookies.delete("caios_search_console_oauth_state");
    return response;
  } catch (error) {
    const message = error instanceof Error ? error.message : "Search Console connection failed.";
    destination.searchParams.set("searchConsoleError", message);
    return NextResponse.redirect(destination);
  }
}
