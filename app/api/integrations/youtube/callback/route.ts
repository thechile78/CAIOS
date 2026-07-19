import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";

import { exchangeYoutubeAuthorizationCode } from "@/lib/youtube-oauth";

export const dynamic = "force-dynamic";

interface YouTubeChannelResponse {
  items?: Array<{
    id: string;
    snippet?: { title?: string; customUrl?: string };
  }>;
}

export async function GET(request: NextRequest) {
  const destination = new URL("/integrations/youtube", request.url);
  const error = request.nextUrl.searchParams.get("error");
  const code = request.nextUrl.searchParams.get("code");
  const state = request.nextUrl.searchParams.get("state");
  const cookieStore = await cookies();
  const expectedState = cookieStore.get("caios_youtube_oauth_state")?.value;

  if (error) {
    destination.searchParams.set("error", error);
    return NextResponse.redirect(destination);
  }

  if (!code || !state || !expectedState || state !== expectedState) {
    destination.searchParams.set("error", "OAuth state validation failed. Start the connection again.");
    return NextResponse.redirect(destination);
  }

  try {
    const tokens = await exchangeYoutubeAuthorizationCode(code);
    const channelResponse = await fetch(
      "https://www.googleapis.com/youtube/v3/channels?part=snippet&mine=true",
      {
        headers: { authorization: `Bearer ${tokens.access_token}` },
        cache: "no-store",
      },
    );

    if (!channelResponse.ok) {
      throw new Error(`YouTube channel verification failed (${channelResponse.status}).`);
    }

    const channelData = (await channelResponse.json()) as YouTubeChannelResponse;
    const channel = channelData.items?.[0];
    if (!channel) throw new Error("Google authorized successfully, but no YouTube channel was found.");

    destination.searchParams.set("connected", "1");
    destination.searchParams.set("channel", channel.snippet?.title ?? channel.id);
    destination.searchParams.set("channelId", channel.id);
    destination.searchParams.set("refreshToken", tokens.refresh_token ? "received" : "not-returned");

    const response = NextResponse.redirect(destination);
    response.cookies.delete("caios_youtube_oauth_state");
    return response;
  } catch (caught) {
    const message = caught instanceof Error ? caught.message : "YouTube connection failed.";
    destination.searchParams.set("error", message);
    return NextResponse.redirect(destination);
  }
}
