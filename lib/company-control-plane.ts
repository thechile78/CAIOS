export type CompanyStatus = "healthy" | "attention" | "blocked" | "idle";
export type WorkStatus = "backlog" | "ready" | "in_progress" | "blocked" | "needs_review" | "approved" | "completed";

export interface CompanyDepartment {
  id: string;
  name: string;
  mission: string;
  status: CompanyStatus;
  activeWork: string;
  blocker: string | null;
}

export interface CompanyProject {
  id: string;
  departmentId: string;
  name: string;
  milestone: string;
  nextAction: string;
  status: WorkStatus;
  priority: number;
  requiresFounderDecision: boolean;
}

export interface ApprovalRequest {
  id: string;
  title: string;
  departmentId: string;
  proposedAction: string;
  reason: string;
  risk: "low" | "medium" | "high";
  externalSideEffect: string;
}

export const departments: CompanyDepartment[] = [
  { id: "newsroom", name: "Newsroom", mission: "Discover, verify, draft, and prepare approval-gated stories.", status: "healthy", activeWork: "Editorial Command Center v4.0", blocker: null },
  { id: "rod-ryan", name: "Rod Ryan Show Production", mission: "Prepare show packets, social drafts, segments, and sponsor support.", status: "attention", activeWork: "Producer workflow design", blocker: "Workflow integration not started" },
  { id: "content-studio", name: "Content Studio", mission: "Create scripts, video prompts, captions, and repurposing packages.", status: "attention", activeWork: "Media Studio review bridge", blocker: "Awaiting control-plane integration" },
  { id: "growth", name: "Growth and Analytics", mission: "Turn audience and search data into prioritized recommendations.", status: "idle", activeWork: "Analytics roadmap", blocker: "Live GA4 and Search Console integration pending" },
  { id: "technology", name: "Technology and Automation", mission: "Build, test, secure, and operate CAIOS.", status: "healthy", activeWork: "v5.0.1 Company Control Plane", blocker: null },
  { id: "business-ops", name: "Business Operations", mission: "Support partnerships, opportunities, meetings, and administration.", status: "idle", activeWork: "Department definition", blocker: null },
];

export const projects: CompanyProject[] = [
  { id: "v5-control-plane", departmentId: "technology", name: "CAIOS v5.0 Personal AI Company", milestone: "5.0.1 Company Control Plane", nextAction: "Review and approve the first control-plane pull request", status: "in_progress", priority: 100, requiresFounderDecision: true },
  { id: "newsroom-v4", departmentId: "newsroom", name: "AI Editorial Command Center", milestone: "4.0 Editorial operations", nextAction: "Continue approval-first newsroom integration", status: "in_progress", priority: 80, requiresFounderDecision: false },
  { id: "media-review", departmentId: "content-studio", name: "Media Studio Review Bridge", milestone: "Private review activation", nextAction: "Review open pull request before any merge", status: "needs_review", priority: 70, requiresFounderDecision: true },
  { id: "rod-ryan-pipeline", departmentId: "rod-ryan", name: "Rod Ryan Producer Pipeline", milestone: "Workflow definition", nextAction: "Map story discovery to producer approval packets", status: "ready", priority: 60, requiresFounderDecision: false },
];

export const approvalRequests: ApprovalRequest[] = [
  {
    id: "approve-v5-slice",
    title: "Approve v5 control-plane direction",
    departmentId: "technology",
    proposedAction: "Merge the reviewed v5 control-plane pull request into main.",
    reason: "Creates the shared company layer without enabling publishing, sending, deployment, or spending.",
    risk: "low",
    externalSideEffect: "Repository main changes only after explicit merge approval.",
  },
];

export function founderPriorities(limit = 3): CompanyProject[] {
  return [...projects]
    .filter((project) => project.status !== "completed")
    .sort((left, right) => Number(right.requiresFounderDecision) - Number(left.requiresFounderDecision) || right.priority - left.priority)
    .slice(0, limit);
}
