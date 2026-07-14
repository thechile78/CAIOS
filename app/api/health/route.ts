import { NextResponse } from "next/server";
import type { PlatformHealth } from "@/lib/domain";

export async function GET() {
  const payload: PlatformHealth = {
    service: "CAIOS",
    version: "4.1.0",
    status: "ok",
    publishingMode: "human-approval-required",
    timestamp: new Date().toISOString(),
  };

  return NextResponse.json(payload, {
    headers: {
      "Cache-Control": "no-store",
    },
  });
}
