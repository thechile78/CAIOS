import { NextResponse } from "next/server";

export function GET(request: Request) {
  const source = new URL(request.url);
  const destination = new URL("/api/integrations/youtube/callback", request.url);
  destination.search = source.search;
  return NextResponse.redirect(destination);
}
