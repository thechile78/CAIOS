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

export interface EditorialQueueFilters {
  status?: string | null;
  query?: string | null;
  desk?: string | null;
  priority?: string | null;
  sort?: string | null;
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

const allowedPriorities = new Set(["breaking", "high", "normal", "low"]);
const allowedSorts = new Set(["updated_desc", "updated_asc", "priority", "title"]);

export function roleCanCreateStory(role: AppRole): boolean {
  return editableRoles.includes(role);
}

export async function listEditorialQueueStories(
  limit = 50,
  filters: EditorialQueueFilters = {},
): Promise<EditorialQueueStory[]> {
  const safeLimit = Math.min(Math.max(Math.trunc(limit), 1), 100);
  const supabase = await createSupabaseServerClient();
  let request = supabase
    .from("stories")
    .select("id,title,desk,priority,status,summary,owner_id,updated_at")
    .neq("status", "archived")
    .limit(safeLimit);

  if (filters.status && workflowStages.some(([value]) => value === filters.status)) {
    request = request.eq("status", filters.status);
  }

  const normalizedQuery = filters.query?.trim().slice(0, 100);
  if (normalizedQuery) {
    const escaped = normalizedQuery.replaceAll(",", " ");
    request = request.or(`title.ilike.%${escaped}%,summary.ilike.%${escaped}%`);
  }

  const normalizedDesk = filters.desk?.trim().slice(0, 60);
  if (normalizedDesk) {
    request = request.eq("desk", normalizedDesk);
  }

  if (filters.priority && allowedPriorities.has(filters.priority)) {
    request = request.eq("priority", filters.priority);
  }

  const sort = filters.sort && allowedSorts.has(filters.sort) ? filters.sort : "updated_desc";
  if (sort === "updated_asc") request = request.order("updated_at", { ascending: true });
  else if (sort === "title") request = request.order("title", { ascending: true });
  else if (sort === "priority") request = request.order("priority", { ascending: true }).order("updated_at", { ascending: false });
  else request = request.order("updated_at", { ascending: false });

  const { data, error } = await request;
  if (error) throw new Error("Unable to load the authenticated editorial queue.");

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

  const countOrZero = (result: { count: number | null; error: unknown }) => result.error ? 0 : result.count ?? 0;
  const totalSources = countOrZero(totalSourcesResult);
  const verifiedSources = countOrZero(verifiedSourcesResult);

  return {
    activeStories: countOrZero(activeResult),
    highPriorityStories: countOrZero(highPriorityResult),
    awaitingApproval: countOrZero(awaitingApprovalResult),
    totalSources,
    verifiedSources,
    sourceHealthPercent: totalSources > 0 ? Math.round((verifiedSources / totalSources) * 100) : null,
    wordpressDrafts: countOrZero(wordpressDraftsResult),
    publishedStories: countOrZero(publishedStoriesResult),
    workflowCounts: workflowStages.map(([status, label], index) => ({
      status,
      label,
      count: countOrZero(workflowResults[index] ?? { count: 0, error: true }),
    })),
    priorityStories: priorityStoriesResult.error ? [] : (priorityStoriesResult.data ?? []).map((story) => ({
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
