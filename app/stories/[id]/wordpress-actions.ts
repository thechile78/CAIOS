"use server";

import { redirect } from "next/navigation";

import { requireRole } from "@/lib/auth";
import { prepareWordPressDraftIntent } from "@/lib/wordpress-draft-bridge";

export async function prepareWordPressDraftIntentAction(formData: FormData) {
  await requireRole(["administrator", "editor"]);

  const storyId = String(formData.get("storyId") ?? "").trim();
  if (!storyId) redirect("/?wordpress_error=invalid_story");

  try {
    await prepareWordPressDraftIntent(storyId);
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown_error";
    const code = message.includes("approved")
      ? "not_approved"
      : message.includes("checklist")
        ? "checklist"
        : message.includes("approval")
          ? "approval"
          : "prepare_failed";
    redirect(`/stories/${storyId}?wordpress_error=${encodeURIComponent(code)}`);
  }

  redirect(`/stories/${storyId}?wordpress_prepared=1`);
}
