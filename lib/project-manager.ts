export const workItemStatuses = ["Backlog", "Ready", "In Progress", "Founder Review", "Approved", "Blocked"] as const;
export const workItemPriorities = ["Critical", "High", "Medium", "Low"] as const;
export const workItemTypes = ["Editorial", "Product", "Revenue", "Operations", "Risk"] as const;
export const workItemApprovers = ["The Chile", "Founder", "Editorial Lead"] as const;

export type WorkItemStatus = (typeof workItemStatuses)[number];
export type WorkItemPriority = (typeof workItemPriorities)[number];
export type WorkItemType = (typeof workItemTypes)[number];
export type WorkItemApprover = (typeof workItemApprovers)[number];

export type WorkItemApproval = {
  required: true;
  approved: boolean;
  approver: WorkItemApprover;
  approvedBy: string | null;
  approvedAt: string | null;
  note: string;
  scope: "internal_work";
  externalActionAuthorized: false;
};

export type GitHubLinkage = {
  issueUrl: string | null;
  branchName: string | null;
  pullRequestUrl: string | null;
};

export type WorkItem = {
  databaseId: string;
  id: string;
  title: string;
  type: WorkItemType;
  status: WorkItemStatus;
  priority: WorkItemPriority;
  owner: string;
  dueLabel: string;
  impact: string;
  approval: WorkItemApproval;
  github: GitHubLinkage;
  blockers: string[];
  updatedAt: string;
};

export function isWorkItemStatus(value: unknown): value is WorkItemStatus {
  return typeof value === "string" && workItemStatuses.includes(value as WorkItemStatus);
}

export function isWorkItemPriority(value: unknown): value is WorkItemPriority {
  return typeof value === "string" && workItemPriorities.includes(value as WorkItemPriority);
}

export function isWorkItemType(value: unknown): value is WorkItemType {
  return typeof value === "string" && workItemTypes.includes(value as WorkItemType);
}

export function isWorkItemApprover(value: unknown): value is WorkItemApprover {
  return typeof value === "string" && workItemApprovers.includes(value as WorkItemApprover);
}

export function getWorkItemsByStatus(items: readonly WorkItem[]) {
  return workItemStatuses.map((status) => ({
    status,
    items: items.filter((item) => item.status === status),
  }));
}

export function getProjectManagerMetrics(items: readonly WorkItem[]) {
  const awaitingApproval = items.filter((item) => item.approval.required && !item.approval.approved);
  const blocked = items.filter((item) => item.blockers.length > 0 || item.status === "Blocked");
  const linkedToGitHub = items.filter(
    (item) => item.github.issueUrl !== null || item.github.branchName !== null || item.github.pullRequestUrl !== null,
  );

  return {
    total: items.length,
    active: items.filter((item) => item.status === "Ready" || item.status === "In Progress" || item.status === "Founder Review").length,
    awaitingApproval: awaitingApproval.length,
    blocked: blocked.length,
    githubPlaceholders: items.length - linkedToGitHub.length,
    approvedInternalOnly: items.filter((item) => item.approval.approved).length,
  };
}

export function canMoveWorkItemToApproved(item: WorkItem) {
  return item.status === "Founder Review"
    && item.approval.required
    && !item.approval.approved
    && item.approval.scope === "internal_work"
    && item.approval.externalActionAuthorized === false;
}
