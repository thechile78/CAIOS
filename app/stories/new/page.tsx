import Link from "next/link";

import { requireRole } from "@/lib/auth";
import { storyPriorities } from "@/lib/story-input";

import { createStory } from "./actions";

const creatorRoles = ["administrator", "editor", "producer", "researcher"] as const;

interface NewStoryPageProps {
  searchParams: Promise<{ error?: string }>;
}

export default async function NewStoryPage({ searchParams }: NewStoryPageProps) {
  await requireRole(creatorRoles);
  const params = await searchParams;

  return (
    <main style={{ maxWidth: "52rem", margin: "0 auto", padding: "2rem" }}>
      <p className="eyebrow">CAIOS Editorial Workflow</p>
      <h1>Create a story record</h1>
      <p>New records begin in discovery. This form cannot approve, publish, schedule, or create a WordPress draft.</p>
      {params.error ? <p role="alert">{params.error}</p> : null}
      <form action={createStory} style={{ display: "grid", gap: "1rem" }}>
        <label>Title<input name="title" maxLength={300} required /></label>
        <label>Desk<input name="desk" maxLength={80} required /></label>
        <label>Priority<select name="priority" defaultValue="normal">{storyPriorities.map((priority) => <option key={priority}>{priority}</option>)}</select></label>
        <label>Summary<textarea name="summary" maxLength={2000} rows={5} /></label>
        <label>Working body<textarea name="body" maxLength={100000} rows={14} /></label>
        <button type="submit">Create discovery record</button>
      </form>
      <p><Link href="/">Return to command center</Link></p>
    </main>
  );
}
