"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { requireRole } from "@/lib/auth";
import {
  isWorkItemApprover,
  isWorkItemPriority,
  isWorkItemStatus,
  isWorkItemType,
} from "@/lib/project-manager";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const administratorRoles = ["administrator"] as const;

function requiredString(formData: FormData, name: string, maxLength: number): string {
  const value = formData.get(name);
  if (typeof value !== "string") throw new Error(`${name} is required`);
  const normalized = value.trim();
  if (!normalized || normalized.length > maxLength) throw new Error(`${name} is invalid`);
  return normalized;
}

function optionalString(formData: FormData, name: string, maxLength: number): string | null {
  const value = formData.get(name);
  if (typeof value !== "string") return null;
  const normalized = value.trim();
  if (normalized.length > maxLength) throw new Error(`${name} is invalid`);
  return normalized || null;
}

function fail(message: string): never {
  redirect(`/?project_error=${encodeURIComponent(message)}#project-manager`);
}

function complete(message: string): never {
  revalidatePath("/");
  redirect(`/?project_status=${encodeURIComponent(message)}#project-manager`);
}

export async function createProjectWorkItem(formData: FormData) {
  await requireRole(administratorRoles);

  let workKey: string;
  let title: string;
  let workType: string;
  let priority: string;
  let ownerLabel: string;
  let dueLabel: string;
  let impact: string;
  let approverLabel: string;
  let approvalNote: string;

  try {
    workKey = requiredString(formData, "workKey", 32).toUpperCase();
    title = requiredString(formData, "title", 160);
    workType = requiredString(formData, "workType", 32);
    priority = requiredString(formData, "priority", 16);
    ownerLabel = requiredString(formData, "ownerLabel", 120);
    dueLabel = requiredString(formData, "dueLabel", 120);
    impact = requiredString(formData, "impact", 1000);
    approverLabel = requiredString(formData, "approverLabel", 32);
    approvalNote = requiredString(formData, "approvalNote", 1000);
  } catch {
    fail("Review the work item fields and try again.");
  }

  if (!/^PM-[0-9]{3,}$/.test(workKey)
    || !isWorkItemType(workType)
    || !isWorkItemPriority(priority)
    || !isWorkItemApprover(approverLabel)) {
    fail("Use a PM-### key and a supported type, priority, and approver.");
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc("create_project_work_item", {
    p_work_key: workKey,
    p_title: title,
    p_work_type: workType,
    p_priority: priority,
    p_owner_label: ownerLabel,
    p_due_label: dueLabel,
    p_impact: impact,
    p_approver_label: approverLabel,
    p_approval_note: approvalNote,
  });

  if (error) fail("The work item could not be created. Confirm the key is unique.");
  complete("Work item created in Backlog.");
}

export async function updateProjectWorkItemStatus(formData: FormData) {
  await requireRole(administratorRoles);

  let workItemId: string;
  let expectedUpdatedAt: string;
  let status: string;
  try {
    workItemId = requiredString(formData, "workItemId", 64);
    expectedUpdatedAt = requiredString(formData, "expectedUpdatedAt", 64);
    status = requiredString(formData, "status", 32);
  } catch {
    fail("The status update request is invalid.");
  }

  if (!isWorkItemStatus(status) || status === "Approved") {
    fail("Approved status requires an explicit human decision.");
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc("update_project_work_item_status", {
    p_work_item_id: workItemId,
    p_expected_updated_at: expectedUpdatedAt,
    p_status: status,
  });

  if (error) fail("The work item changed or could not be updated.");
  complete(`Work item moved to ${status}.`);
}

export async function recordProjectWorkItemDecision(formData: FormData) {
  await requireRole(administratorRoles);

  let workItemId: string;
  let expectedUpdatedAt: string;
  let decision: string;
  let note: string | null;
  try {
    workItemId = requiredString(formData, "workItemId", 64);
    expectedUpdatedAt = requiredString(formData, "expectedUpdatedAt", 64);
    decision = requiredString(formData, "decision", 32);
    note = optionalString(formData, "note", 4000);
  } catch {
    fail("The decision request is invalid.");
  }

  if (!["approved", "changes_requested", "rejected"].includes(decision)) {
    fail("Choose a supported human decision.");
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc("record_project_work_item_decision", {
    p_work_item_id: workItemId,
    p_expected_updated_at: expectedUpdatedAt,
    p_decision: decision,
    p_note: note,
  });

  if (error) fail("The item changed or is no longer awaiting Founder Review.");
  complete("Human decision recorded for internal work only.");
}
