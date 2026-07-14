export const kpis = [
  { label: "Stories in Queue", value: 12, detail: "Awaiting review" },
  { label: "Approval Pending", value: 4, detail: "Final stage" },
  { label: "Published Today", value: 8, detail: "Human approved" },
];

export const alerts = [
  { id: 1, severity: "HIGH", title: "Breaking News Alert", reason: "Requires immediate verification" },
];

export const siteHealth = [
  { label: "API Status", status: "Operational", tone: "healthy" },
  { label: "Database", status: "Operational", tone: "healthy" },
];

export const stories = [
  { id: 1, score: 92, headline: "Sample Story", desk: "Politics", sourceCount: 3, stage: "Research", houstonRelevant: true },
];

export const workflow = ["Discovery", "Verification", "Research", "Draft", "Fact Check", "SEO Review", "Human Approval", "WordPress Draft", "Published"];
