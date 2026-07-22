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

export interface ProjectWorkstream {
  id: string;
  departmentId: string;
  name: string;
  milestone: string;
  nextAction: string;
  status: WorkStatus;
  sequence: number;
  requiresFounderDecision: boolean;
}

export interface CompanyProject {
  id: string;
  name: string;
  objective: string;
  milestone: string;
  nextAction: string;
  status: WorkStatus;
  activeWorkstreamId: string;
  workstreams: ProjectWorkstream[];
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
  { id: "newsroom", name: "Newsroom", mission: "Discover, verify, draft, and prepare approval-gated stories.", status: "healthy", activeWork: "Included in the unified CAIOS project", blocker: null },
  { id: "rod-ryan", name: "Rod Ryan Show Production", mission: "Prepare show packets, social drafts, segments, and sponsor support.", status: "idle", activeWork: "Queued inside the unified CAIOS project", blocker: "Starts after the control-plane milestone is complete" },
  { id: "content-studio", name: "Content Studio", mission: "Create scripts, video prompts, captions, and repurposing packages.", status: "idle", activeWork: "Queued inside the unified CAIOS project", blocker: "Existing review bridge remains isolated until its turn in sequence" },
  { id: "growth", name: "Growth and Analytics", mission: "Turn audience and search data into prioritized recommendations.", status: "idle", activeWork: "Queued inside the unified CAIOS project", blocker: "Starts after core operational workflows are unified" },
  { id: "technology", name: "Technology and Automation", mission: "Build, test, secure, and operate CAIOS.", status: "healthy", activeWork: "Current workstream: Company Control Plane", blocker: null },
  { id: "business-ops", name: "Business Operations", mission: "Support partnerships, opportunities, meetings, and administration.", status: "idle", activeWork: "Queued inside the unified CAIOS project", blocker: "Starts after the core departments are operational" },
];

export const caiosProject: CompanyProject = {
  id: "caios-comprehensive",
  name: "CAIOS Comprehensive Operating System",
  objective: "Deliver one approval-first operating system that combines the Newsroom, Rod Ryan Show, Content Studio, Growth, Technology, and Business Operations without creating competing unfinished projects.",
  milestone: "5.0.1 Company Control Plane",
  nextAction: "Build and validate the Founder Brief as the first visible control-plane slice.",
  status: "in_progress",
  activeWorkstreamId: "company-control-plane",
  workstreams: [
    { id: "company-control-plane", departmentId: "technology", name: "Company Control Plane", milestone: "5.0.1", nextAction: "Build Founder Brief, unified status, and approval visibility", status: "in_progress", sequence: 1, requiresFounderDecision: false },
    { id: "newsroom-integration", departmentId: "newsroom", name: "Newsroom Integration", milestone: "5.0.2", nextAction: "Connect existing editorial operations to the shared project and approval model", status: "backlog", sequence: 2, requiresFounderDecision: false },
    { id: "media-studio-integration", departmentId: "content-studio", name: "Content Studio and Media Review", milestone: "5.0.3", nextAction: "Reconcile the existing Media Studio review branch with the unified control plane", status: "backlog", sequence: 3, requiresFounderDecision: true },
    { id: "rod-ryan-integration", departmentId: "rod-ryan", name: "Rod Ryan Producer Pipeline", milestone: "5.0.4", nextAction: "Connect story discovery, show packets, sponsor work, and social approvals", status: "backlog", sequence: 4, requiresFounderDecision: false },
    { id: "growth-integration", departmentId: "growth", name: "Growth and Analytics", milestone: "5.0.5", nextAction: "Add unified performance reporting and recommendations", status: "backlog", sequence: 5, requiresFounderDecision: false },
    { id: "business-operations", departmentId: "business-ops", name: "Business Operations", milestone: "5.0.6", nextAction: "Add partnerships, opportunities, and administrative workflows", status: "backlog", sequence: 6, requiresFounderDecision: false },
  ],
};

// Compatibility export: the control plane exposes exactly one comprehensive project.
export const projects: CompanyProject[] = [caiosProject];

export const approvalRequests: ApprovalRequest[] = [
  {
    id: "approve-v5-merge",
    title: "Approve the unified CAIOS milestone",
    departmentId: "technology",
    proposedAction: "Merge the reviewed milestone only after its tests pass and the founder explicitly approves it.",
    reason: "Keeps every department inside one project and prevents parallel unfinished initiatives.",
    risk: "low",
    externalSideEffect: "Repository main changes only after explicit merge approval.",
  },
];

export function activeWorkstream(): ProjectWorkstream {
  const active = caiosProject.workstreams.find((workstream) => workstream.id === caiosProject.activeWorkstreamId);
  if (!active || active.status !== "in_progress") throw new Error("CAIOS must have exactly one active workstream.");
  return active;
}

export function founderPriorities(limit = 3): ProjectWorkstream[] {
  return [...caiosProject.workstreams]
    .filter((workstream) => workstream.status !== "completed")
    .sort((left, right) => Number(right.status === "in_progress") - Number(left.status === "in_progress") || Number(right.requiresFounderDecision) - Number(left.requiresFounderDecision) || left.sequence - right.sequence)
    .slice(0, limit);
}
