"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { requireCurrentProfile, roleCanReview } from "@/lib/auth";
import { runApprovedFeedDiscovery } from "@/lib/news-discovery";

export async function runNewsDiscovery() {
  const profile = await requireCurrentProfile();
  if (!roleCanReview(profile.role) && profile.role !== "administrator") {
    redirect("/?discovery=forbidden");
  }

  try {
    const result = await runApprovedFeedDiscovery(8);
    revalidatePath("/");

    const params = new URLSearchParams({
      discovery: "complete",
      created: String(result.storiesCreated),
      duplicates: String(result.duplicatesSkipped),
      errors: String(result.feedErrors.length),
    });
    redirect(`/?${params.toString()}`);
  } catch {
    redirect("/?discovery=failed");
  }
}
