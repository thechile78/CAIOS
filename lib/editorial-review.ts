import "server-only";

import { createSupabaseServerClient } from "@/lib/supabase/server";

export interface EditorialReviewRecord {
  id: string;
  title: string;
  status: string;
  updatedAt: string;
  checklist: {
    sourcesVerified: boolean;
    factsVerified: boolean;
    rightsReviewed: boolean;
    seoReviewed: boolean;
    humanApproved: boolean;
  };
  decisions: Array<{
    decision: "approved" | "rejected" | "changes_requested";
    note: string | null;
    createdAt: string;
  }>;
}

export async function getEditorialReview(storyId: string): Promise<EditorialReviewRecord | null> {
  const supabase = await createSupabaseServerClient();
  const { data: story, error: storyError } = await supabase
    .from("stories")
    .select("id,title,status,updated_at")
    .eq("id", storyId)
    .maybeSingle();

  if (storyError) throw new Error("Unable to load the story review.");
  if (!story) return null;

  const [{ data: checklist, error: checklistError }, { data: approvals, error: approvalsError }] = await Promise.all([
    supabase
      .from("editorial_checklists")
      .select("sources_verified,facts_verified,rights_reviewed,seo_reviewed,human_approved")
      .eq("story_id", storyId)
      .maybeSingle(),
    supabase
      .from("approvals")
      .select("decision,note,created_at")
      .eq("story_id", storyId)
      .order("created_at", { ascending: false })
      .limit(20),
  ]);

  if (checklistError || approvalsError) throw new Error("Unable to load editorial review details.");

  return {
    id: story.id,
    title: story.title,
    status: story.status,
    updatedAt: story.updated_at,
    checklist: {
      sourcesVerified: checklist?.sources_verified ?? false,
      factsVerified: checklist?.facts_verified ?? false,
      rightsReviewed: checklist?.rights_reviewed ?? false,
      seoReviewed: checklist?.seo_reviewed ?? false,
      humanApproved: checklist?.human_approved ?? false,
    },
    decisions: (approvals ?? []).map((item) => ({
      decision: item.decision,
      note: item.note,
      createdAt: item.created_at,
    })),
  };
}
