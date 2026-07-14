import "server-only";

import { createSupabaseServerClient } from "@/lib/supabase/server";

export interface PackageHandoffRecord {
  id: string;
  storyId: string;
  state: "ready_for_packaging" | "packaging" | "packaged" | "cancelled";
  updatedAt: string;
  note: string | null;
  story: {
    id: string;
    title: string;
    status: string;
    desk: string;
    priority: string;
    summary: string | null;
    body: string | null;
    approvedBy: string | null;
    approvedAt: string | null;
  };
  packageId: string | null;
}

export async function getPackageHandoff(id: string): Promise<PackageHandoffRecord | null> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("editorial_handoffs")
    .select("id, story_id, state, updated_at, note, stories(id, title, status, desk, priority, summary, body, approved_by, approved_at), editorial_packages(id)")
    .eq("id", id)
    .single();

  if (error || !data) return null;

  const raw = data as unknown as {
    id: string;
    story_id: string;
    state: PackageHandoffRecord["state"];
    updated_at: string;
    note: string | null;
    stories: PackageHandoffRecord["story"] extends infer _T
      ? {
          id: string;
          title: string;
          status: string;
          desk: string;
          priority: string;
          summary: string | null;
          body: string | null;
          approved_by: string | null;
          approved_at: string | null;
        }
      : never;
    editorial_packages: Array<{ id: string }> | null;
  };

  return {
    id: raw.id,
    storyId: raw.story_id,
    state: raw.state,
    updatedAt: raw.updated_at,
    note: raw.note,
    story: {
      id: raw.stories.id,
      title: raw.stories.title,
      status: raw.stories.status,
      desk: raw.stories.desk,
      priority: raw.stories.priority,
      summary: raw.stories.summary,
      body: raw.stories.body,
      approvedBy: raw.stories.approved_by,
      approvedAt: raw.stories.approved_at,
    },
    packageId: raw.editorial_packages?.[0]?.id ?? null,
  };
}
