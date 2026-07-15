import Link from "next/link";
import { notFound } from "next/navigation";

import { requireCurrentProfile, roleCanEdit } from "@/lib/auth";
import { getStoryIntelligence } from "@/lib/story-intelligence";
import { getWordPressDraftBridgeState } from "@/lib/wordpress-draft-bridge";
import { saveStoryEditorialAction } from "./actions";
import { prepareWordPressDraftIntentAction } from "./wordpress-actions";

export const dynamic = "force-dynamic";

interface StoryPageProps {
  params: Promise<{ id: string }>;
  searchParams: Promise<{
    editorial_error?: string;
    editorial_saved?: string;
    wordpress_error?: string;
    wordpress_prepared?: string;
  }>;
}

export default async function StoryIntelligencePage({ params, searchParams }: StoryPageProps) {
  const profile = await requireCurrentProfile();
  const { id } = await params;
  const notices = await searchParams;
  const intelligence = await getStoryIntelligence(id);
  if (!intelligence) notFound();

  const bridge = await getWordPressDraftBridgeState(id);
  const { story, sources, similarStories } = intelligence;
  const editable = roleCanEdit(profile.role) && ["discovered", "researching"].includes(String(story.status));
  const canPrepareWordPress = ["administrator", "editor"].includes(profile.role) && story.status === "approved";
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
  const wordpressErrorMessage = notices.wordpress_error === "not_approved"
    ? "This story is not approved. Complete the editorial checklist and approval workflow before preparing a WordPress draft."
    : notices.wordpress_error === "checklist"
      ? "The approved editorial checklist is incomplete."
      : notices.wordpress_error === "approval"
        ? "The matching human approval record is missing."
        : notices.wordpress_error
          ? "The WordPress draft intent could not be prepared. No external WordPress request was made."
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
      {wordpressErrorMessage ? <div className="editorial-notice editorial-notice-error" role="alert">{wordpressErrorMessage}</div> : null}
      {notices.wordpress_prepared ? <div className="editorial-notice editorial-notice-success" role="status">The immutable package and WordPress draft intent are prepared. No external WordPress request has been made.</div> : null}

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

      <section className="panel wordpress-bridge-panel">
        <div className="panel-heading">
          <div><p className="eyebrow">Approval-gated delivery</p><h3>WordPress Draft Bridge</h3></div>
          <span className="safety-badge safety-strong">Draft only</span>
        </div>
        <div className="wordpress-bridge-grid">
          <div><strong>Approval status</strong><span>{story.status === "approved" ? "Approved" : "Not approved"}</span></div>
          <div><strong>Handoff</strong><span>{bridge.handoff?.state ?? "Not created"}</span></div>
          <div><strong>Immutable package</strong><span>{bridge.editorialPackage ? `Version ${bridge.editorialPackage.version}` : "Not created"}</span></div>
          <div><strong>Draft outbox</strong><span>{bridge.outbox?.state ?? "Not queued"}</span></div>
        </div>
        {bridge.outbox?.lastError ? <p className="editorial-notice editorial-notice-error">Last dispatch error: {bridge.outbox.lastError}</p> : null}
        {bridge.outbox?.externalPostUrl ? <p><a className="secondary-button" href={bridge.outbox.externalPostUrl} target="_blank" rel="noreferrer">Open WordPress draft</a></p> : null}
        {canPrepareWordPress && !bridge.outbox ? (
          <form action={prepareWordPressDraftIntentAction}>
            <input type="hidden" name="storyId" value={story.id} />
            <button className="primary-button" type="submit">Prepare WordPress draft intent</button>
          </form>
        ) : null}
        {!canPrepareWordPress && !bridge.outbox ? <p>Available only after the story is fully approved by an administrator or editor. Preparing the intent does not contact WordPress.</p> : null}
        {bridge.outbox ? <p>The draft intent is recorded in the audited outbox. External dispatch remains disabled until WordPress credentials and an explicit dispatch control are configured.</p> : null}
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
