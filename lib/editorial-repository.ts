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

export interface WorkflowCount {
  status: string;
  label: string;
  count: number;
}

export interface NewsroomDashboardSnapshot {
  activeStories: number;
  highPriorityStories: number;
  awaitingApproval: number;
  verifiedSources: number;
  totalSources: number;
  sourceHealthPercent: number | null;
  priorityStories: EditorialQueueStory[];
  workflowCounts: WorkflowCount[];
  wordpressDrafts: number;
  publishedStories: number;
}

const workflowStages = [
  ["discovered", "Discovery"],
  ["researching", "Research"],
  ["fact_check", "Fact Check"],
  ["drafting", "Drafting"],
  ["seo_review", "SEO Review"],
  ["asset_review", "Asset Review"],
  ["awaiting_approval", "Awaiting Approval"],
  ["approved", "Approved"],
] as const;

export function roleCanCreateStory(role: AppRole): boolean {
  return editableRoles.includes(role);
}

export async function listEditorialQueueStories(
  limit = 25,
  status?: string | null,
): Promise<EditorialQueueStory[]> {
  const safeLimit = Math.min(Math.max(Math.trunc(limit), 1), 100);
  const supabase = await createSupabaseServerClient();
  let query = supabase
    .from("stories")
    .select("id,title,desk,priority,status,summary,owner_id,updated_at")
    .neq("status", "archived")
    .order("updated_at", { ascending: false })
    .limit(safeLimit);

  if (status && workflowStages.some(([value]) => value === status)) {
    query = query.eq("status", status);
  }

  const { data, error } = await query;

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

export async function getNewsroomDashboardSnapshot(): Promise<NewsroomDashboardSnapshot> {
  const supabase = await createSupabaseServerClient();

  const workflowRequests = workflowStages.map(([status]) =>
    supabase.from("stories").select("id", { count: "exact", head: true }).eq("status", status),
  );

  const [
    activeResult,
    highPriorityResult,
    awaitingApprovalResult,
    totalSourcesResult,
    verifiedSourcesResult,
    priorityStoriesResult,
    wordpressDraftsResult,
    publishedStoriesResult,
    ...workflowResults
  ] = await Promise.all([
    supabase.from("stories").select("id", { count: "exact", head: true }).neq("status", "archived"),
    supabase.from("stories").select("id", { count: "exact", head: true }).neq("status", "archived").in("priority", ["breaking", "high"]),
    supabase.from("stories").select("id", { count: "exact", head: true }).eq("status", "awaiting_approval"),
    supabase.from("story_sources").select("id", { count: "exact", head: true }),
    supabase.from("story_sources").select("id", { count: "exact", head: true }).eq("verified", true),
    supabase.from("stories").select("id,title,desk,priority,status,summary,owner_id,updated_at").neq("status", "archived").in("priority", ["breaking", "high"]).order("updated_at", { ascending: false }).limit(5),
    supabase.from("wordpress_draft_outbox").select("id", { count: "exact", head: true }).eq("state", "dispatched"),
    supabase.from("stories").select("id", { count: "exact", head: true }).eq("status", "published"),
    ...workflowRequests,
  ]);

  const failures = [
    activeResult.error,
    highPriorityResult.error,
    awaitingApprovalResult.error,
    totalSourcesResult.error,
    verifiedSourcesResult.error,
    priorityStoriesResult.error,
    wordpressDraftsResult.error,
    publishedStoriesResult.error,
    ...workflowResults.map((result) => result.error),
  ].filter(Boolean);

  if (failures.length > 0) {
    throw new Error("Unable to load the live newsroom dashboard snapshot.");
  }

  const totalSources = totalSourcesResult.count ?? 0;
  const verifiedSources = verifiedSourcesResult.count ?? 0;

  return {
    activeStories: activeResult.count ?? 0,
    highPriorityStories: highPriorityResult.count ?? 0,
    awaitingApproval: awaitingApprovalResult.count ?? 0,
    totalSources,
    verifiedSources,
    sourceHealthPercent: totalSources > 0 ? Math.round((verifiedSources / totalSources) * 100) : null,
    wordpressDrafts: wordpressDraftsResult.count ?? 0,
    publishedStories: publishedStoriesResult.count ?? 0,
    workflowCounts: workflowStages.map(([status, label], index) => ({
      status,
      label,
      count: workflowResults[index]?.count ?? 0,
    })),
    priorityStories: (priorityStoriesResult.data ?? []).map((story) => ({
      id: story.id,
      title: story.title,
      desk: story.desk,
      priority: story.priority,
      status: story.status,
      summary: story.summary,
      ownerId: story.owner_id,
      updatedAt: story.updated_at,
    })),
  };
}
