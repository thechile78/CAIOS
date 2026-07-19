import { randomBytes } from "node:crypto";

import { NextResponse } from "next/server";

import { buildYoutubeAuthorizationUrl } from "@/lib/youtube-oauth";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const state = randomBytes(32).toString("hex");
    const response = NextResponse.redirect(buildYoutubeAuthorizationUrl(state));
    response.cookies.set("caios_youtube_oauth_state", state, {
      httpOnly: true,
      secure: true,
      sameSite: "lax",
      maxAge: 10 * 60,
      path: "/",
    });
    return response;
  } catch (error) {
    const message = error instanceof Error ? error.message : "YouTube OAuth is not configured.";
    const url = new URL("/integrations/youtube", "https://caios.vercel.app");
    url.searchParams.set("error", message);
    return NextResponse.redirect(url);
  }
}
