import "server-only";

import type { AppRole } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const handoffRoles: readonly AppRole[] = [
  "administrator",
  "editor",
  "producer",
];

export interface ApprovalQueueItem {
  id: string;
  title: string;
  desk: string;
  priority: string;
  status: "awaiting_approval" | "approved";
  updatedAt: string;
  approvedAt: string | null;
  handoffState: string | null;
}

export function roleCanRequestHandoff(role: AppRole): boolean {
  return handoffRoles.includes(role);
}

export async function listApprovalQueue(limit = 50): Promise<ApprovalQueueItem[]> {
  const safeLimit = Math.min(Math.max(Math.trunc(limit), 1), 100);
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("stories")
    .select("id,title,desk,priority,status,updated_at,approved_at,editorial_handoffs(state)")
    .in("status", ["awaiting_approval", "approved"])
    .order("updated_at", { ascending: false })
    .limit(safeLimit);

  if (error) throw new Error("Unable to load the approval queue.");

  return (data ?? []).map((story) => {
    const handoffs = Array.isArray(story.editorial_handoffs)
      ? story.editorial_handoffs
      : [];
    const active = handoffs.find((handoff) => handoff.state !== "cancelled");

    return {
      id: story.id,
      title: story.title,
      desk: story.desk,
      priority: story.priority,
      status: story.status as "awaiting_approval" | "approved",
      updatedAt: story.updated_at,
      approvedAt: story.approved_at,
      handoffState: active?.state ?? null,
    };
  });
}
