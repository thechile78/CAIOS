import "server-only";

import type { AppRole } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const editableRoles: readonly AppRole[] = [
  "administrator",
  "editor",
  "producer",
  "researcher",
];

export interface EditorialQueueStory {
  id: string;
  title: string;
  desk: string;
  priority: "breaking" | "high" | "normal" | "low";
  status: string;
  summary: string | null;
  ownerId: string | null;
  updatedAt: string;
}

export function roleCanCreateStory(role: AppRole): boolean {
  return editableRoles.includes(role);
}

export async function listEditorialQueueStories(
  limit = 25,
): Promise<EditorialQueueStory[]> {
  const safeLimit = Math.min(Math.max(Math.trunc(limit), 1), 100);
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("stories")
    .select("id,title,desk,priority,status,summary,owner_id,updated_at")
    .neq("status", "archived")
    .order("updated_at", { ascending: false })
    .limit(safeLimit);

  if (error) {
    throw new Error("Unable to load the authenticated editorial queue.");
  }

  return (data ?? []).map((story) => ({
    id: story.id,
    title: story.title,
    desk: story.desk,
    priority: story.priority,
    status: story.status,
    summary: story.summary,
    ownerId: story.owner_id,
    updatedAt: story.updated_at,
  }));
}
