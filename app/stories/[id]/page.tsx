import Link from "next/link";
import { notFound } from "next/navigation";

import { requireCurrentProfile, roleCanEdit } from "@/lib/auth";
import { getStoryIntelligence } from "@/lib/story-intelligence";
import { saveStoryEditorialAction } from "./actions";

export const dynamic = "force-dynamic";

interface StoryPageProps {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ editorial_error?: string; editorial_saved?: string }>;
}

export default async function StoryIntelligencePage({ params, searchParams }: StoryPageProps) {
  const profile = await requireCurrentProfile();
  const { id } = await params;
  const notices = await searchParams;
  const intelligence = await getStoryIntelligence(id);
  if (!intelligence) notFound();

  const { story, sources, similarStories } = intelligence;
  const editable = roleCanEdit(profile.role) && ["discovered", "researching"].includes(String(story.status));
  const errorMessage = notices.editorial_error === "conflict"
    ? "This story changed after the page loaded. Reload before saving so another editor’s work is not overwritten."
    : notices.editorial_error
      ? "The editorial update was not saved. Review the fields and try again."
      : null;
  const savedMessage = notices.editorial_saved
    ? notices.editorial_saved === "researching"
      ? "Changes saved and the story moved into research review."
      : "Editorial changes saved."
    : null;

  return (
    <main className="content story-workspace">
      <p><Link href="/">← Back to newsroom</Link></p>
      <header className="hero">
        <p className="eyebrow">Story Intelligence v1 · Validated editorial workspace</p>
        <h2>{story.title}</h2>
        <p>{story.desk} · {String(story.status).replaceAll("_", " ")} · Current priority: {story.priority}</p>
      </header>

      {errorMessage ? <div className="editorial-notice editorial-notice-error" role="alert">{errorMessage}</div> : null}
      {savedMessage ? <div className="editorial-notice editorial-notice-success" role="status">{savedMessage}</div> : null}

      <section className="kpi-grid">
        <article className="kpi-card"><span>Confidence</span><strong>{intelligence.confidence}%</strong><small>Source-based heuristic, not a factual guarantee</small></article>
        <article className="kpi-card"><span>Houston relevance</span><strong>{intelligence.houstonRelevant ? "Yes" : "No"}</strong><small>Requires human confirmation</small></article>
        <article className="kpi-card"><span>Suggested priority</span><strong>{intelligence.recommendedPriority}</strong><small>Recommendation only</small></article>
        <article className="kpi-card"><span>Sources</span><strong>{sources.length}</strong><small>{intelligence.verificationStatus}</small></article>
      </section>

      <section className="panel editorial-workspace-panel">
        <div className="panel-heading">
          <div><p className="eyebrow">Validated write path</p><h3>Edit story record</h3></div>
          <span className="safety-badge safety-strong">No publishing</span>
        </div>
        {editable ? (
          <form action={saveStoryEditorialAction} className="editorial-form">
            <input type="hidden" name="storyId" value={story.id} />
            <input type="hidden" name="expectedUpdatedAt" value={story.updated_at} />
            <label>Headline<input name="title" defaultValue={story.title} minLength={8} maxLength={220} required /></label>
            <div className="editorial-form-grid">
              <label>Desk<input name="desk" defaultValue={story.desk} maxLength={80} required /></label>
              <label>Priority<select name="priority" defaultValue={story.priority}><option value="breaking">Breaking</option><option value="high">High</option><option value="normal">Normal</option><option value="low">Low</option></select></label>
            </div>
            <label>Summary<textarea name="summary" defaultValue={story.summary ?? ""} rows={4} maxLength={1200} /></label>
            <label>Working notes / body<textarea name="body" defaultValue={story.body ?? ""} rows={9} maxLength={30000} /></label>
            <div className="editorial-action-row">
              <button className="secondary-button" type="submit" name="targetStatus" value={String(story.status)}>Save changes</button>
              {story.status === "discovered" ? <button className="primary-button" type="submit" name="targetStatus" value="researching">Save and move to research</button> : null}
            </div>
            <p className="editorial-form-note">Every update uses optimistic concurrency and the database audit function. Approval, WordPress drafting, and publishing remain unavailable here.</p>
          </form>
        ) : <p>This record is read-only for your role or current workflow stage.</p>}
      </section>

      <section className="dashboard-grid">
        <article className="panel panel-wide"><p className="eyebrow">5-second briefing</p><h3>{intelligence.briefing}</h3><p>{intelligence.whyItMatters}</p></article>
        <article className="panel"><p className="eyebrow">Editorial safeguards</p><p>No AI-generated claim is treated as verified. Review the original source, confirm facts, and check image rights before advancing this story.</p></article>
      </section>

      <section className="panel">
        <div className="panel-heading"><div><p className="eyebrow">Source attribution</p><h3>Original reporting</h3></div></div>
        {sources.length ? <div className="alert-list">{sources.map((source) => <div className="alert-item" key={source.id}><span className={`severity ${source.verified ? "severity-high" : ""}`}>{source.verified ? "Verified" : "Unverified"}</span><div><strong>{source.publisher}</strong><p>{source.title ?? source.url}</p></div><a className="secondary-button" href={source.url} target="_blank" rel="noreferrer">Open source</a></div>)}</div> : <p>No source records are attached.</p>}
      </section>

      <section className="panel"><p className="eyebrow">Drafting assistance</p><h3>Suggested headline</h3><p>{intelligence.suggestedHeadline}</p><h3>Meta description</h3><p>{intelligence.metaDescription}</p></section>

      <section className="panel"><p className="eyebrow">Similarity check</p><h3>Potentially related stories</h3>{similarStories.length ? <ul>{similarStories.map((item) => <li key={item.id}><Link href={`/stories/${item.id}`}>{item.title}</Link> — {Math.round(item.similarity * 100)}% title overlap</li>)}</ul> : <p>No meaningful title overlap found in the active queue.</p>}</section>
    </main>
  );
}
