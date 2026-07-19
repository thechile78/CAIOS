import "server-only";

import { createSupabaseServerClient } from "@/lib/supabase/server";

export type SocialDraftStatus =
  | "draft"
  | "ready_for_review"
  | "changes_requested"
  | "approved"
  | "rejected";

export interface SocialDraft {
  id: string;
  title: string;
  facebookCaption: string | null;
  instagramCaption: string | null;
  facebookPageId: string;
  instagramAccountId: string;
  status: SocialDraftStatus;
  contentHash: string;
  updatedAt: string;
  publishingEnabled: boolean;
  schedulingEnabled: boolean;
  autoPostEnabled: boolean;
  autoApprovalEnabled: boolean;
  approvalRequired: boolean;
  decisions: Array<{
    decision: "approved" | "changes_requested" | "rejected";
    note: string | null;
    contentHash: string;
    createdAt: string;
  }>;
}

export async function listSocialDrafts(): Promise<SocialDraft[]> {
  const supabase = await createSupabaseServerClient();
  const { data: drafts, error } = await supabase
    .from("social_content_drafts")
    .select("id,title,facebook_caption,instagram_caption,facebook_page_id,instagram_account_id,status,content_hash,updated_at,publishing_enabled,scheduling_enabled,auto_post_enabled,auto_approval_enabled,approval_required")
    .order("updated_at", { ascending: false })
    .limit(50);

  if (error) throw new Error("Unable to load private social drafts.");

  const ids = (drafts ?? []).map((draft) => draft.id);
  const approvalsResult = ids.length === 0
    ? { data: [], error: null }
    : await supabase
        .from("social_content_approvals")
        .select("content_item_id,decision,note,content_hash,created_at")
        .in("content_item_id", ids)
        .order("created_at", { ascending: false });

  if (approvalsResult.error) throw new Error("Unable to load social approval history.");

  return (drafts ?? []).map((draft) => ({
    id: draft.id,
    title: draft.title,
    facebookCaption: draft.facebook_caption,
    instagramCaption: draft.instagram_caption,
    facebookPageId: draft.facebook_page_id,
    instagramAccountId: draft.instagram_account_id,
    status: draft.status as SocialDraftStatus,
    contentHash: draft.content_hash,
    updatedAt: draft.updated_at,
    publishingEnabled: draft.publishing_enabled === true,
    schedulingEnabled: draft.scheduling_enabled === true,
    autoPostEnabled: draft.auto_post_enabled === true,
    autoApprovalEnabled: draft.auto_approval_enabled === true,
    approvalRequired: draft.approval_required === true,
    decisions: (approvalsResult.data ?? [])
      .filter((approval) => approval.content_item_id === draft.id)
      .map((approval) => ({
        decision: approval.decision as "approved" | "changes_requested" | "rejected",
        note: approval.note,
        contentHash: approval.content_hash,
        createdAt: approval.created_at,
      })),
  }));
}
