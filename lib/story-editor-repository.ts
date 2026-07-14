import "server-only";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { EditableStoryStatus } from "@/lib/story-edit";
import type { StoryPriorityInput } from "@/lib/story-input";

export interface EditableStoryRecord {
  id: string;
  title: string;
  desk: string;
  priority: StoryPriorityInput;
  status: EditableStoryStatus;
  summary: string | null;
  body: string | null;
  updatedAt: string;
}

export async function getEditableStory(storyId: string): Promise<EditableStoryRecord | null> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("stories")
    .select("id,title,desk,priority,status,summary,body,updated_at")
    .eq("id", storyId)
    .single();

  if (error || !data) return null;
  if (["approved", "wordpress_draft", "published", "archived"].includes(data.status)) return null;

  return {
    id: data.id,
    title: data.title,
    desk: data.desk,
    priority: data.priority,
    status: data.status,
    summary: data.summary,
    body: data.body,
    updatedAt: data.updated_at,
  };
}
