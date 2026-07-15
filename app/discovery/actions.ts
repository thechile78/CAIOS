"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { requireCurrentProfile } from "@/lib/auth";
import { roleCanCreateStory } from "@/lib/editorial-repository";
import { runApprovedFeedDiscovery } from "@/lib/news-discovery";

export async function runNewsDiscovery() {
  const profile = await requireCurrentProfile();
  if (!roleCanCreateStory(profile.role)) {
    redirect("/?discovery=forbidden");
  }

  let result;
  try {
    result = await runApprovedFeedDiscovery(8);
  } catch {
    redirect("/?discovery=failed");
  }

  revalidatePath("/");
  const params = new URLSearchParams({
    discovery: "complete",
    created: String(result.storiesCreated),
    duplicates: String(result.duplicatesSkipped),
    errors: String(result.feedErrors.length),
  });
  redirect(`/?${params.toString()}`);
}
