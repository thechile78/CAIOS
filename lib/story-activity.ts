import "server-only";

import { createSupabaseServerClient } from "@/lib/supabase/server";

const labels: Record<string, string> = {
  story_created: "Story created",
  story_updated: "Story updated",
  editorial_checklist_saved: "Editorial checklist saved",
  editorial_decision_recorded: "Editorial decision recorded",
  approved_story_handoff_requested: "WordPress handoff requested",
  editorial_package_created: "Immutable editorial package created",
  wordpress_draft_intent_queued: "WordPress draft intent queued",
  wordpress_draft_dispatch_started: "WordPress draft dispatch started",
  wordpress_draft_dispatch_succeeded: "WordPress draft created",
  wordpress_draft_dispatch_failed: "WordPress draft dispatch failed",
};

function describe(eventType: string, eventData: Record<string, unknown> | null): string {
  const data = eventData ?? {};
  if (eventType === "story_updated") {
    const from = String(data.from_status ?? "unknown").replaceAll("_", " ");
    const to = String(data.to_status ?? "unknown").replaceAll("_", " ");
    return from === to ? `Saved in ${to}.` : `Moved from ${from} to ${to}.`;
  }
  if (eventType === "editorial_decision_recorded") {
    const decision = String(data.decision ?? "decision").replaceAll("_", " ");
    const note = typeof data.note === "string" && data.note.trim() ? ` — ${data.note.trim()}` : "";
    return `${decision}${note}`;
  }
  if (eventType === "editorial_checklist_saved") {
    const completed = ["sources_verified", "facts_verified", "rights_reviewed", "seo_reviewed"]
      .filter((key) => data[key] === true).length;
    return `${completed} of 4 required checks completed.`;
  }
  if (eventType === "wordpress_draft_dispatch_failed") {
    return typeof data.error === "string" ? data.error : "The external draft request failed.";
  }
  return labels[eventType] ? "Audited newsroom event." : eventType.replaceAll("_", " ");
}

export async function getStoryActivity(storyId: string) {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("audit_events")
    .select("id,event_type,event_data,created_at,actor_id")
    .eq("story_id", storyId)
    .order("created_at", { ascending: false })
    .limit(50);

  if (error) return [];

  return (data ?? []).map((event) => ({
    id: event.id,
    label: labels[event.event_type] ?? event.event_type.replaceAll("_", " "),
    description: describe(event.event_type, event.event_data as Record<string, unknown> | null),
    createdAt: event.created_at,
    actorId: event.actor_id,
  }));
}
