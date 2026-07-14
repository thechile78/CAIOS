export const editorialStages = [
  "Discovery",
  "Verification",
  "Research",
  "Draft",
  "Fact Check",
  "SEO Review",
  "Human Approval",
  "WordPress Draft",
  "Published",
] as const;

export type EditorialStage = (typeof editorialStages)[number];

export type Desk =
  | "Houston"
  | "Music"
  | "Entertainment"
  | "Sports"
  | "Food"
  | "Viral"
  | "Behind the Mic";

export type Priority = "Critical" | "High" | "Medium" | "Low";

export type ApprovalChecklist = {
  sourcesVerified: boolean;
  factsChecked: boolean;
  imageRightsCleared: boolean;
  seoComplete: boolean;
  accessibilityReviewed: boolean;
  humanApproved: boolean;
};

export type Story = {
  id: string;
  headline: string;
  desk: Desk;
  priority: Priority;
  stage: EditorialStage;
  sourceUrls: string[];
  confidenceScore: number;
  houstonRelevance: number;
  seoOpportunity: number;
  checklist: ApprovalChecklist;
  updatedAt: string;
};

export type SourceHealth = {
  id: string;
  name: string;
  status: "Healthy" | "Degraded" | "Failed" | "Pending";
  reliabilityScore: number;
  lastCheckedAt: string | null;
};

export type NewsAlert = {
  id: string;
  title: string;
  severity: "Critical" | "High" | "Medium";
  sourceCount: number;
  confidenceScore: number;
  acknowledged: boolean;
};

export type PlatformHealth = {
  service: string;
  version: string;
  status: "ok" | "degraded";
  publishingMode: "human-approval-required";
  timestamp: string;
};
