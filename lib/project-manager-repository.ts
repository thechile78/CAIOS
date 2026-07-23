import "server-only";

import {
  isWorkItemApprover,
  isWorkItemPriority,
  isWorkItemStatus,
  isWorkItemType,
  type WorkItem,
} from "@/lib/project-manager";
import { createSupabaseServerClient } from "@/lib/supabase/server";

function requiredEnum<T>(value: unknown, predicate: (candidate: unknown) => candidate is T, field: string): T {
  if (!predicate(value)) throw new Error(`Invalid persisted project work item ${field}.`);
  return value;
}

export async function listProjectWorkItems(): Promise<WorkItem[]> {
  const supabase = await createSupabaseServerClient();
  const { data: rows, error } = await supabase
    .from("project_work_items")
    .select("id,work_key,title,work_type,status,priority,owner_label,due_label,impact,approval_required,approver_label,approval_note,approval_scope,external_action_authorized,github_issue_url,github_branch_name,github_pull_request_url,blockers,approved_by,approved_at,updated_at")
    .order("updated_at", { ascending: false });

  if (error) throw new Error("Unable to load persisted Project Manager work items.");

  const approverIds = [...new Set((rows ?? []).map((row) => row.approved_by).filter((id): id is string => typeof id === "string"))];
  const profilesResult = approverIds.length === 0
    ? { data: [], error: null }
    : await supabase.from("profiles").select("id,display_name").in("id", approverIds);

  if (profilesResult.error) throw new Error("Unable to load Project Manager approver identities.");
  const namesById = new Map((profilesResult.data ?? []).map((profile) => [profile.id, profile.display_name]));

  return (rows ?? []).map((row) => {
    const approvedById = typeof row.approved_by === "string" ? row.approved_by : null;
    const approvedAt = typeof row.approved_at === "string" ? row.approved_at : null;
    const approved = row.status === "Approved" && approvedById !== null && approvedAt !== null;

    if (row.approval_required !== true || row.approval_scope !== "internal_work" || row.external_action_authorized !== false) {
      throw new Error("Persisted Project Manager approval safeguards are invalid.");
    }

    return {
      databaseId: row.id,
      id: row.work_key,
      title: row.title,
      type: requiredEnum(row.work_type, isWorkItemType, "type"),
      status: requiredEnum(row.status, isWorkItemStatus, "status"),
      priority: requiredEnum(row.priority, isWorkItemPriority, "priority"),
      owner: row.owner_label,
      dueLabel: row.due_label,
      impact: row.impact,
      approval: {
        required: true,
        approved,
        approver: requiredEnum(row.approver_label, isWorkItemApprover, "approver"),
        approvedBy: approvedById ? namesById.get(approvedById) ?? "Recorded administrator" : null,
        approvedAt,
        note: row.approval_note,
        scope: "internal_work",
        externalActionAuthorized: false,
      },
      github: {
        issueUrl: row.github_issue_url,
        branchName: row.github_branch_name,
        pullRequestUrl: row.github_pull_request_url,
      },
      blockers: Array.isArray(row.blockers) ? row.blockers.filter((blocker): blocker is string => typeof blocker === "string") : [],
      updatedAt: row.updated_at,
    } satisfies WorkItem;
  });
}
