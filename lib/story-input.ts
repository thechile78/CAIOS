export const storyPriorities = ["breaking", "high", "normal", "low"] as const;
export type StoryPriorityInput = (typeof storyPriorities)[number];

export interface ValidStoryInput {
  title: string;
  desk: string;
  priority: StoryPriorityInput;
  summary: string | null;
  body: string | null;
}

export interface StoryInputResult {
  value: ValidStoryInput | null;
  errors: string[];
}

function cleanOptional(value: FormDataEntryValue | null): string | null {
  if (typeof value !== "string") return null;
  const cleaned = value.trim();
  return cleaned.length ? cleaned : null;
}

export function validateStoryForm(formData: FormData): StoryInputResult {
  const title = cleanOptional(formData.get("title")) ?? "";
  const desk = cleanOptional(formData.get("desk")) ?? "";
  const rawPriority = cleanOptional(formData.get("priority")) ?? "normal";
  const summary = cleanOptional(formData.get("summary"));
  const body = cleanOptional(formData.get("body"));
  const errors: string[] = [];

  if (title.length < 1 || title.length > 300) errors.push("Title must be between 1 and 300 characters.");
  if (desk.length < 1 || desk.length > 80) errors.push("Desk must be between 1 and 80 characters.");
  if (!storyPriorities.includes(rawPriority as StoryPriorityInput)) errors.push("Priority is invalid.");
  if (summary && summary.length > 2000) errors.push("Summary must not exceed 2,000 characters.");
  if (body && body.length > 100000) errors.push("Body must not exceed 100,000 characters.");

  if (errors.length) return { value: null, errors };

  return {
    value: {
      title,
      desk,
      priority: rawPriority as StoryPriorityInput,
      summary,
      body,
    },
    errors,
  };
}
