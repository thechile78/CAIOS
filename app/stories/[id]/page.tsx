import Link from "next/link";
import { notFound } from "next/navigation";

import { requireCurrentProfile, roleCanEdit, roleCanReview } from "@/lib/auth";
import { getStoryIntelligence } from "@/lib/story-intelligence";
import { getWordPressDraftBridgeState } from "@/lib/wordpress-draft-bridge";
import { saveStoryEditorialAction } from "./actions";
import { recordEditorialDecisionAction, saveEditorialChecklistAction } from "./approval-actions";
import { EditorialScorecard } from "./editorial-scorecard";
import { prepareWordPressDraftIntentAction } from "./wordpress-actions";

export const dynamic = "force-dynamic";

interface StoryPageProps {
  params: Promise<{ id: string }>;
  searchParams: Promise<{
    editorial_error?: string;
    editorial_saved?: string;
    approval_error?: string;
    checklist_saved?: string;
    decision_recorded?: string;
    wordpress_error?: string;
    wordpress_prepared?: string;
  }>;
}

const nextStage: Record<string, { value: string; label: string } | undefined> = {
  discovered: { value: "researching", label: "Move to research" },
  researching: { value: "fact_check", label: "Move to fact check" },
  fact_check: { value: "drafting", label: "Move to drafting" },
  drafting: { value: "seo_review", label: "Move to SEO review" },
  seo_review: { value: "asset_review", label: "Move to asset review" },
  asset_review: { value: "awaiting_approval", label: "Submit for approval" },
};

export default async function StoryIntelligencePage({ params, searchParams }: StoryPageProps) {
  const profile = await requireCurrentProfile();
  const { id } = await params;
  const notices = await searchParams;
  const intelligence = await getStoryIntelligence(id);
  if (!intelligence) notFound();

  const bridge = await getWordPressDraftBridgeState(id);
  const { story, sources, similarStories, checklist, approvals } = intelligence;
  const status = String(story.status);
  const editable = roleCanEdit(profile.role) && !["approved", "wordpress_draft", "published", "archived"].includes(status);
  const checklistEditable = (roleCanEdit(profile.role) || roleCanReview(profile.role)) && !["approved", "wordpress_draft", "published", "archived"].includes(status);
  const canDecide = roleCanReview(profile.role) && status === "awaiting_approval";
  const canPrepareWordPress = ["administrator", "editor"].includes(profile.role) && status === "approved";
  const advance = nextStage[status];

  const errorMessage = notices.editorial_error === "conflict"
    ? "This story changed after the page loaded. Reload before saving so another editor’s work is not overwritten."
    : notices.editorial_error === "invalid_transition"
      ? "That workflow transition is not allowed from the current stage."
      : notices.editorial_error
        ? "The editorial update was not saved. Review the fields and try again."
        : null;
  const approvalError = notices.approval_error === "conflict"
    ? "The story changed after this page loaded. Reload before saving the checklist or decision."
    : notices.approval_error === "checklist"
      ? "Approval requires all four checklist items to be completed."
      : notices.approval_error === "wrong_stage"
        ? "A decision can only be recorded while the story is awaiting approval."
        : notices.approval_error
          ? "The approval action could not be completed."
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
        <p>{story.desk} · {status.replaceAll("_", " ")} · Current priority: {story.priority}</p>
      </header>

      {errorMessage ? <div className="editorial-notice editorial-notice-error" role="alert">{errorMessage}</div> : null}
      {approvalError ? <div className="editorial-notice editorial-notice-error" role="alert">{approvalError}</div> : null}
      {wordpressErrorMessage ? <div className="editorial-notice editorial-notice-error" role="alert">{wordpressErrorMessage}</div> : null}
      {notices.editorial_saved ? <div className="editorial-notice editorial-notice-success" role="status">Changes saved. Current stage: {notices.editorial_saved.replaceAll("_", " ")}.</div> : null}
      {notices.checklist_saved ? <div className="editorial-notice editorial-notice-success" role="status">Editorial checklist saved and audited.</div> : null}
      {notices.decision_recorded ? <div className="editorial-notice editorial-notice-success" role="status">Editorial decision recorded: {notices.decision_recorded.replaceAll("_", " ")}.</div> : null}
      {notices.wordpress_prepared ? <div className="editorial-notice editorial-notice-success" role="status">The immutable package and WordPress draft intent are prepared. No external WordPress request has been made.</div> : null}

      <section className="kpi-grid">
        <article className="kpi-card"><span>Confidence</span><strong>{intelligence.confidence}%</strong><small>Source-based heuristic, not a factual guarantee</small></article>
        <article className="kpi-card"><span>Houston relevance</span><strong>{intelligence.houstonRelevant ? "Yes" : "No"}</strong><small>Requires human confirmation</small></article>
        <article className="kpi-card"><span>Suggested priority</span><strong>{intelligence.recommendedPriority}</strong><small>Recommendation only</small></article>
        <article className="kpi-card"><span>Sources</span><strong>{sources.length}</strong><small>{intelligence.verificationStatus}</small></article>
      </section>

      <EditorialScorecard scorecard={intelligence.scorecard} />

      <section className="panel editorial-workspace-panel">
        <div className="panel-heading"><div><p className="eyebrow">Validated write path</p><h3>Edit story record</h3></div><span className="safety-badge safety-strong">No publishing</span></div>
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
              <button className="secondary-button" type="submit" name="targetStatus" value={status}>Save changes</button>
              {advance ? <button className="primary-button" type="submit" name="targetStatus" value={advance.value}>{advance.label}</button> : null}
            </div>
            <p className="editorial-form-note">Every update uses optimistic concurrency and the database audit function. Publishing remains unavailable here.</p>
          </form>
        ) : <p>This record is read-only for your role or current workflow stage.</p>}
      </section>

      <section className="panel approval-center-panel">
        <div className="panel-heading"><div><p className="eyebrow">Human approval boundary</p><h3>Approval Center v1</h3></div><span className="safety-badge">Audited decisions</span></div>
        <div className="approval-status-grid">
          <div><strong>Sources verified</strong><span>{checklist?.sources_verified ? "Complete" : "Required"}</span></div>
          <div><strong>Facts verified</strong><span>{checklist?.facts_verified ? "Complete" : "Required"}</span></div>
          <div><strong>Rights reviewed</strong><span>{checklist?.rights_reviewed ? "Complete" : "Required"}</span></div>
          <div><strong>SEO reviewed</strong><span>{checklist?.seo_reviewed ? "Complete" : "Required"}</span></div>
        </div>
        {checklistEditable ? (
          <form action={saveEditorialChecklistAction} className="approval-checklist-form">
            <input type="hidden" name="storyId" value={story.id} />
            <input type="hidden" name="expectedUpdatedAt" value={story.updated_at} />
            <label><input type="checkbox" name="sourcesVerified" defaultChecked={checklist?.sources_verified ?? false} /> I reviewed and verified the cited sources.</label>
            <label><input type="checkbox" name="factsVerified" defaultChecked={checklist?.facts_verified ?? false} /> I checked the factual claims against the available reporting.</label>
            <label><input type="checkbox" name="rightsReviewed" defaultChecked={checklist?.rights_reviewed ?? false} /> I reviewed image, media, attribution, and usage rights.</label>
            <label><input type="checkbox" name="seoReviewed" defaultChecked={checklist?.seo_reviewed ?? false} /> I reviewed the headline, summary, metadata, and SEO requirements.</label>
            <button className="secondary-button" type="submit">Save editorial checklist</button>
          </form>
        ) : null}
        {canDecide ? (
          <form action={recordEditorialDecisionAction} className="editorial-form approval-decision-form">
            <input type="hidden" name="storyId" value={story.id} />
            <input type="hidden" name="expectedUpdatedAt" value={story.updated_at} />
            <label>Reviewer note<textarea name="note" rows={4} maxLength={4000} placeholder="Record the reason for the decision or requested changes." /></label>
            <div className="editorial-action-row">
              <button className="primary-button" type="submit" name="decision" value="approved">Approve story</button>
              <button className="secondary-button" type="submit" name="decision" value="changes_requested">Request changes</button>
              <button className="secondary-button" type="submit" name="decision" value="rejected">Reject to fact check</button>
            </div>
          </form>
        ) : <p>{status === "approved" ? "This story has a recorded human approval." : "Decision controls become available to reviewers when the story reaches awaiting approval."}</p>}
        {approvals.length ? <div className="approval-history"><h4>Decision history</h4><ul>{approvals.map((approval) => <li key={approval.id}><strong>{String(approval.decision).replaceAll("_", " ")}</strong> · {new Date(approval.created_at).toLocaleString()}{approval.note ? ` — ${approval.note}` : ""}</li>)}</ul></div> : null}
      </section>

      <section className="panel wordpress-bridge-panel">
        <div className="panel-heading"><div><p className="eyebrow">Approval-gated delivery</p><h3>WordPress Draft Bridge</h3></div><span className="safety-badge safety-strong">Draft only</span></div>
        <div className="wordpress-bridge-grid">
          <div><strong>Approval status</strong><span>{status === "approved" ? "Approved" : "Not approved"}</span></div>
          <div><strong>Handoff</strong><span>{bridge.handoff?.state ?? "Not created"}</span></div>
          <div><strong>Immutable package</strong><span>{bridge.editorialPackage ? `Version ${bridge.editorialPackage.version}` : "Not created"}</span></div>
          <div><strong>Draft outbox</strong><span>{bridge.outbox?.state ?? "Not queued"}</span></div>
        </div>
        {bridge.outbox?.lastError ? <p className="editorial-notice editorial-notice-error">Last dispatch error: {bridge.outbox.lastError}</p> : null}
        {bridge.outbox?.externalPostUrl ? <p><a className="secondary-button" href={bridge.outbox.externalPostUrl} target="_blank" rel="noreferrer">Open WordPress draft</a></p> : null}
        {canPrepareWordPress && !bridge.outbox ? <form action={prepareWordPressDraftIntentAction}><input type="hidden" name="storyId" value={story.id} /><button className="primary-button" type="submit">Prepare WordPress draft intent</button></form> : null}
        {!canPrepareWordPress && !bridge.outbox ? <p>Available only after the story is fully approved by an administrator or editor. Preparing the intent does not contact WordPress.</p> : null}
        {bridge.outbox ? <p>The draft intent is recorded in the audited outbox. External dispatch remains disabled until WordPress credentials and an explicit dispatch control are configured.</p> : null}
      </section>

      <section className="dashboard-grid">
        <article className="panel panel-wide"><p className="eyebrow">5-second briefing</p><h3>{intelligence.briefing}</h3><p>{intelligence.whyItMatters}</p></article>
        <article className="panel"><p className="eyebrow">Editorial safeguards</p><p>No AI-generated claim is treated as verified. Review the original source, confirm facts, and check image rights before advancing this story.</p></article>
      </section>

      <section className="panel"><div className="panel-heading"><div><p className="eyebrow">Source attribution</p><h3>Original reporting</h3></div></div>{sources.length ? <div className="alert-list">{sources.map((source) => <div className="alert-item" key={source.id}><span className={`severity ${source.verified ? "severity-high" : ""}`}>{source.verified ? "Verified" : "Unverified"}</span><div><strong>{source.publisher}</strong><p>{source.title ?? source.url}</p></div><a className="secondary-button" href={source.url} target="_blank" rel="noreferrer">Open source</a></div>)}</div> : <p>No source records are attached.</p>}</section>
      <section className="panel"><p className="eyebrow">Drafting assistance</p><h3>Suggested headline</h3><p>{intelligence.suggestedHeadline}</p><h3>Meta description</h3><p>{intelligence.metaDescription}</p></section>
      <section className="panel"><p className="eyebrow">Similarity check</p><h3>Potentially related stories</h3>{similarStories.length ? <ul>{similarStories.map((item) => <li key={item.id}><Link href={`/stories/${item.id}`}>{item.title}</Link> — {Math.round(item.similarity * 100)}% title overlap</li>)}</ul> : <p>No meaningful title overlap found in the active queue.</p>}</section>
    </main>
  );
}
