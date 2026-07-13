export type Severity = "Critical" | "High" | "Medium" | "Low";
export type WorkflowStage =
  | "Discovery"
  | "Verification"
  | "Research"
  | "Draft"
  | "Fact Check"
  | "SEO Review"
  | "Human Approval"
  | "WordPress Draft";

export type Story = {
  id: string;
  headline: string;
  desk: string;
  score: number;
  sourceCount: number;
  stage: WorkflowStage;
  severity: Severity;
  houstonRelevant: boolean;
};

export const kpis = [
  { label: "Active Alerts", value: "3", detail: "2 require review" },
  { label: "Stories in Queue", value: "18", detail: "6 high priority" },
  { label: "Awaiting Approval", value: "4", detail: "No auto-publish" },
  { label: "Source Health", value: "96%", detail: "2 feeds need attention" },
];

export const alerts = [
  {
    id: "alert-1",
    title: "Major Houston weather update developing",
    reason: "Three trusted local sources are reporting the same development.",
    severity: "Critical" as Severity,
  },
  {
    id: "alert-2",
    title: "Core rock artist announces new tour dates",
    reason: "Official announcement plus two music publications.",
    severity: "High" as Severity,
  },
];

export const stories: Story[] = [
  {
    id: "story-1",
    headline: "Houston venue announces major fall concert",
    desk: "Houston / Music",
    score: 94,
    sourceCount: 4,
    stage: "Verification",
    severity: "High",
    houstonRelevant: true,
  },
  {
    id: "story-2",
    headline: "Alternative rock band previews upcoming album",
    desk: "Music",
    score: 88,
    sourceCount: 3,
    stage: "Research",
    severity: "Medium",
    houstonRelevant: false,
  },
  {
    id: "story-3",
    headline: "Texas restaurant launches unusual limited-time menu",
    desk: "Food",
    score: 82,
    sourceCount: 2,
    stage: "Draft",
    severity: "Medium",
    houstonRelevant: true,
  },
  {
    id: "story-4",
    headline: "Viral performance gains national attention",
    desk: "Viral",
    score: 79,
    sourceCount: 2,
    stage: "Human Approval",
    severity: "Low",
    houstonRelevant: false,
  },
];

export const workflow: WorkflowStage[] = [
  "Discovery",
  "Verification",
  "Research",
  "Draft",
  "Fact Check",
  "SEO Review",
  "Human Approval",
  "WordPress Draft",
];

export const siteHealth = [
  { label: "Search Console", status: "Connected", tone: "good" },
  { label: "GA4", status: "Pending credentials", tone: "warning" },
  { label: "Sitemap", status: "Healthy", tone: "good" },
  { label: "Broken links", status: "2 detected", tone: "warning" },
];
