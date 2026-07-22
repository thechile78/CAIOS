export const workItemStatuses = ["Backlog", "Ready", "In Progress", "Founder Review", "Approved", "Blocked"] as const;

export type WorkItemStatus = (typeof workItemStatuses)[number];
export type WorkItemPriority = "Critical" | "High" | "Medium" | "Low";
export type WorkItemType = "Editorial" | "Product" | "Revenue" | "Operations" | "Risk";

export type WorkItemApproval = {
  required: boolean;
  approved: boolean;
  approver: "The Chile" | "Founder" | "Editorial Lead";
  note: string;
};

export type GitHubLinkage = {
  issueUrl: string | null;
  branchName: string | null;
  pullRequestUrl: string | null;
};

export type WorkItem = {
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
};

export const projectWorkItems: WorkItem[] = [
  {
    id: "PM-101",
    title: "Approval Queue hardening",
    type: "Risk",
    status: "In Progress",
    priority: "Critical",
    owner: "Newsroom Engineering",
    dueLabel: "This sprint",
    impact: "Protects the human approval boundary before any WordPress or social handoff.",
    approval: {
      required: true,
      approved: false,
      approver: "The Chile",
      note: "Cannot ship to public channels until The Chile signs off.",
    },
    github: {
      issueUrl: null,
      branchName: "placeholder/approval-queue-hardening",
      pullRequestUrl: null,
    },
    blockers: ["Founder review pending"],
  },
  {
    id: "PM-112",
    title: "GA4 and Search Console readiness",
    type: "Operations",
    status: "Ready",
    priority: "High",
    owner: "Founder",
    dueLabel: "Next setup block",
    impact: "Prepares audience signal reporting without changing publishing permissions.",
    approval: {
      required: true,
      approved: false,
      approver: "Founder",
      note: "Credentials stay server-side and must be reviewed before connection.",
    },
    github: {
      issueUrl: null,
      branchName: null,
      pullRequestUrl: null,
    },
    blockers: [],
  },
  {
    id: "PM-124",
    title: "Sponsorship package tracker",
    type: "Revenue",
    status: "Backlog",
    priority: "Medium",
    owner: "Founder",
    dueLabel: "Post-launch prep",
    impact: "Tracks revenue operations before external commitments are made.",
    approval: {
      required: true,
      approved: false,
      approver: "Founder",
      note: "Founder approval required before sponsor-facing language is used.",
    },
    github: {
      issueUrl: null,
      branchName: null,
      pullRequestUrl: null,
    },
    blockers: ["Awaiting offer list"],
  },
  {
    id: "PM-137",
    title: "WordPress draft QA checklist",
    type: "Editorial",
    status: "Founder Review",
    priority: "Critical",
    owner: "The Chile",
    dueLabel: "Before dispatch expansion",
    impact: "Keeps drafts review-only and documents source, fact, SEO, accessibility, and image-rights checks.",
    approval: {
      required: true,
      approved: false,
      approver: "The Chile",
      note: "Approval gate remains closed until every checklist item is verified.",
    },
    github: {
      issueUrl: null,
      branchName: "placeholder/wp-draft-qa-checklist",
      pullRequestUrl: null,
    },
    blockers: ["The Chile approval required"],
  },
  {
    id: "PM-143",
    title: "Mobile command-center polish",
    type: "Product",
    status: "Approved",
    priority: "Low",
    owner: "Design Ops",
    dueLabel: "Queued",
    impact: "Improves founder dashboard accessibility and small-screen review comfort.",
    approval: {
      required: true,
      approved: true,
      approver: "Founder",
      note: "Approved for internal UI work only; no publishing scope included.",
    },
    github: {
      issueUrl: null,
      branchName: "placeholder/mobile-command-center-polish",
      pullRequestUrl: null,
    },
    blockers: [],
  },
];

export function getWorkItemsByStatus(items: readonly WorkItem[] = projectWorkItems) {
  return workItemStatuses.map((status) => ({
    status,
    items: items.filter((item) => item.status === status),
  }));
}

export function getProjectManagerMetrics(items: readonly WorkItem[] = projectWorkItems) {
  const approvalRequired = items.filter((item) => item.approval.required);
  const awaitingApproval = approvalRequired.filter((item) => !item.approval.approved);
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
    approvedInternalOnly: approvalRequired.filter((item) => item.approval.approved).length,
  };
}

export function canMoveWorkItemToApproved(item: WorkItem) {
  return item.approval.required && item.approval.approved;
}
