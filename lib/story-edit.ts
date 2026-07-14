import { storyPriorities, type StoryPriorityInput } from "@/lib/story-input";

export const editableStoryStatuses = [
  "discovered",
  "researching",
  "fact_check",
  "drafting",
  "seo_review",
  "asset_review",
  "awaiting_approval",
] as const;

export type EditableStoryStatus = (typeof editableStoryStatuses)[number];

export const allowedStoryTransitions: Record<EditableStoryStatus, readonly EditableStoryStatus[]> = {
  discovered: ["discovered", "researching"],
  researching: ["researching", "fact_check", "drafting"],
  fact_check: ["fact_check", "researching", "drafting"],
  drafting: ["drafting", "fact_check", "seo_review"],
  seo_review: ["seo_review", "drafting", "asset_review"],
  asset_review: ["asset_review", "seo_review", "awaiting_approval"],
  awaiting_approval: ["awaiting_approval", "asset_review"],
};

export interface ValidStoryEdit {
  storyId: string;
  expectedUpdatedAt: string;
  title: string;
  desk: string;
  priority: StoryPriorityInput;
  summary: string | null;
  body: string | null;
  targetStatus: EditableStoryStatus;
}

function clean(value: FormDataEntryValue | null): string {
  return typeof value === "string" ? value.trim() : "";
}

export function validateStoryEdit(formData: FormData): { value: ValidStoryEdit | null; errors: string[] } {
  const storyId = clean(formData.get("storyId"));
  const expectedUpdatedAt = clean(formData.get("expectedUpdatedAt"));
  const title = clean(formData.get("title"));
  const desk = clean(formData.get("desk"));
  const priority = clean(formData.get("priority"));
  const summary = clean(formData.get("summary")) || null;
  const bodyValue = typeof formData.get("body") === "string" ? String(formData.get("body")) : "";
  const body = bodyValue || null;
  const targetStatus = clean(formData.get("targetStatus"));
  const errors: string[] = [];

  if (!/^[0-9a-f-]{36}$/i.test(storyId)) errors.push("Story ID is invalid.");
  if (!expectedUpdatedAt || Number.isNaN(Date.parse(expectedUpdatedAt))) errors.push("Story version is invalid.");
  if (title.length < 1 || title.length > 300) errors.push("Title must be between 1 and 300 characters.");
  if (desk.length < 1 || desk.length > 80) errors.push("Desk must be between 1 and 80 characters.");
  if (!storyPriorities.includes(priority as StoryPriorityInput)) errors.push("Priority is invalid.");
  if (summary && summary.length > 2000) errors.push("Summary must not exceed 2,000 characters.");
  if (body && body.length > 100000) errors.push("Body must not exceed 100,000 characters.");
  if (!editableStoryStatuses.includes(targetStatus as EditableStoryStatus)) errors.push("Target status is invalid.");

  if (errors.length) return { value: null, errors };
  return {
    value: {
      storyId,
      expectedUpdatedAt,
      title,
      desk,
      priority: priority as StoryPriorityInput,
      summary,
      body,
      targetStatus: targetStatus as EditableStoryStatus,
    },
    errors,
  };
}
