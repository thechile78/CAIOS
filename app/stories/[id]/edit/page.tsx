import { notFound } from "next/navigation";

import { requireRole } from "@/lib/auth";
import { allowedStoryTransitions } from "@/lib/story-edit";
import { getEditableStory } from "@/lib/story-editor-repository";
import { storyPriorities } from "@/lib/story-input";

import { updateStory } from "./actions";

const editorRoles = ["administrator", "editor", "producer", "researcher"] as const;

interface StoryEditPageProps {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string; saved?: string }>;
}

export default async function StoryEditPage({ params, searchParams }: StoryEditPageProps) {
  await requireRole(editorRoles);
  const [{ id }, query] = await Promise.all([params, searchParams]);
  const story = await getEditableStory(id);
  if (!story) notFound();

  const targets = allowedStoryTransitions[story.status];

  return (
    <main style={{ maxWidth: "52rem", margin: "0 auto", padding: "2rem", display: "grid", gap: "1rem" }}>
      <div>
        <p className="eyebrow">CAIOS Controlled Story Editor</p>
        <h1>Edit story</h1>
        <p>Every successful save is version-checked and written with an audit event. Approval and publishing are not available here.</p>
      </div>

      {query.error ? <p role="alert">{query.error}</p> : null}
      {query.saved ? <p role="status">Story saved and audit event recorded.</p> : null}

      <form action={updateStory} style={{ display: "grid", gap: "1rem" }}>
        <input type="hidden" name="storyId" value={story.id} />
        <input type="hidden" name="expectedUpdatedAt" value={story.updatedAt} />

        <label>Title<input name="title" defaultValue={story.title} maxLength={300} required /></label>
        <label>Desk<input name="desk" defaultValue={story.desk} maxLength={80} required /></label>
        <label>Priority<select name="priority" defaultValue={story.priority}>{storyPriorities.map((value) => <option key={value} value={value}>{value}</option>)}</select></label>
        <label>Workflow status<select name="targetStatus" defaultValue={story.status}>{targets.map((value) => <option key={value} value={value}>{value.replaceAll("_", " ")}</option>)}</select></label>
        <label>Summary<textarea name="summary" defaultValue={story.summary ?? ""} maxLength={2000} rows={5} /></label>
        <label>Body<textarea name="body" defaultValue={story.body ?? ""} maxLength={100000} rows={18} /></label>
        <button type="submit">Save reviewed changes</button>
      </form>
    </main>
  );
}
