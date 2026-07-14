export type EditorialStage = 
  | "Discovery"
  | "Verification"
  | "Research"
  | "Draft"
  | "Fact Check"
  | "SEO Review"
  | "Human Approval"
  | "WordPress Draft"
  | "Published";

export interface ApprovalChecklist {
  sourcesVerified: boolean;
  factsChecked: boolean;
  imageRightsCleared: boolean;
  seoComplete: boolean;
  accessibilityReviewed: boolean;
  humanApproved: boolean;
}

export interface PlatformHealth {
  service: string;
  version: string;
  status: string;
  publishingMode: string;
  timestamp: string;
}
