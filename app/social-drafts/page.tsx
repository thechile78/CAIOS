import Link from "next/link";

import { requireCurrentProfile, roleCanEdit, roleCanReview } from "@/lib/auth";
import { listSocialDrafts } from "@/lib/social-drafts";

import {
  createSocialDraft,
  recordSocialDraftDecision,
  submitSocialDraftForReview,
} from "./actions";

export const dynamic = "force-dynamic";

interface SocialDraftsPageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

function readParam(value: string | string[] | undefined): string | null {
  return typeof value === "string" ? value : null;
}

export default async function SocialDraftsPage({ searchParams }: SocialDraftsPageProps) {
  const profile = await requireCurrentProfile();
  const params = await searchParams;
  const drafts = await listSocialDrafts();
  const canEdit = roleCanEdit(profile.role);
  const canReview = roleCanReview(profile.role);
  const error = readParam(params.error);

  return (
    <main className="shell">
      <section className="content story-workspace">
        <header className="hero">
          <p className="eyebrow">CAIOS Social Hub</p>
          <h1>Private Meta drafts</h1>
          <p>Create and review private copy for Chilemaniacs and @thechilepromotions. This workflow has no publishing or scheduling capability.</p>
        </header>

        {error ? <p className="editorial-notice editorial-notice-error" role="alert">{error}</p> : null}
        {readParam(params.created) ? <p className="editorial-notice editorial-notice-success" role="status">Private draft created. It remains blocked from approval and publishing.</p> : null}
        {readParam(params.submitted) ? <p className="editorial-notice editorial-notice-success" role="status">Draft submitted for explicit human review. Nothing was published or scheduled.</p> : null}
        {readParam(params.decision) ? <p className="editorial-notice editorial-notice-success" role="status">Human decision recorded. Publishing remains disabled.</p> : null}

        <section className="panel approval-center-panel">
          <div className="panel-heading">
            <div><p className="eyebrow">Hard safeguards</p><h2>Draft-only workflow</h2></div>
            <span className="safety-badge safety-strong">Approval required</span>
          </div>
          <ul>
            <li>Facebook target: Chilemaniacs — 1214069685123391</li>
            <li>Instagram target: @thechilepromotions — 17841403279084160</li>
            <li>Publishing, scheduling, automatic posting, and automatic approval are disabled.</li>
            <li>Approval records are append-only and bound to an exact content hash.</li>
          </ul>
        </section>

        {canEdit ? (
          <section className="panel">
            <div className="panel-heading"><div><p className="eyebrow">Private workspace</p><h2>Create a draft</h2></div></div>
            <form action={createSocialDraft} className="editorial-form">
              <label>Internal title<input name="title" maxLength={160} required /></label>
              <label>Facebook caption<textarea name="facebookCaption" maxLength={5000} rows={6} /></label>
              <label>Instagram caption<textarea name="instagramCaption" maxLength={2200} rows={6} /></label>
              <p className="editorial-form-note">Creating this record only saves private copy. It cannot publish, schedule, queue, or approve a post.</p>
              <button className="primary-button" type="submit">Save private draft</button>
            </form>
          </section>
        ) : null}

        <section className="panel">
          <div className="panel-heading"><div><p className="eyebrow">Human review queue</p><h2>Social drafts</h2></div></div>
          {drafts.length === 0 ? <p>No private social drafts exist yet.</p> : (
            <div className="social-draft-list">
              {drafts.map((draft) => (
                <article className="social-draft-card" key={draft.id}>
                  <div className="panel-heading">
                    <div>
                      <h3>{draft.title}</h3>
                      <p>{draft.status.replaceAll("_", " ")} · Updated {new Date(draft.updatedAt).toLocaleString()}</p>
                    </div>
                    <span className="safety-badge">{draft.approvalRequired ? "Approval required" : "Unsafe configuration"}</span>
                  </div>
                  {draft.facebookCaption ? <div><strong>Facebook</strong><p>{draft.facebookCaption}</p></div> : null}
                  {draft.instagramCaption ? <div><strong>Instagram</strong><p>{draft.instagramCaption}</p></div> : null}
                  <p className="editorial-form-note">Content hash: <code>{draft.contentHash}</code></p>
                  <p className="editorial-form-note">Publish {draft.publishingEnabled ? "enabled" : "disabled"} · Schedule {draft.schedulingEnabled ? "enabled" : "disabled"} · Auto-post {draft.autoPostEnabled ? "enabled" : "disabled"} · Auto-approval {draft.autoApprovalEnabled ? "enabled" : "disabled"}</p>

                  {canEdit && ["draft", "changes_requested"].includes(draft.status) ? (
                    <form action={submitSocialDraftForReview}>
                      <input type="hidden" name="contentItemId" value={draft.id} />
                      <input type="hidden" name="expectedUpdatedAt" value={draft.updatedAt} />
                      <button className="secondary-button" type="submit">Submit for human review</button>
                    </form>
                  ) : null}

                  {canReview && draft.status === "ready_for_review" ? (
                    <form action={recordSocialDraftDecision} className="editorial-form approval-decision-form">
                      <input type="hidden" name="contentItemId" value={draft.id} />
                      <input type="hidden" name="expectedUpdatedAt" value={draft.updatedAt} />
                      <label>Review note<textarea name="note" maxLength={4000} rows={3} /></label>
                      <div className="editorial-action-row">
                        <button className="primary-button" name="decision" value="approved" type="submit">Approve this exact draft</button>
                        <button className="secondary-button" name="decision" value="changes_requested" type="submit">Request changes</button>
                        <button className="secondary-button" name="decision" value="rejected" type="submit">Reject</button>
                      </div>
                    </form>
                  ) : null}

                  {draft.decisions.length > 0 ? (
                    <div className="approval-history">
                      <h4>Append-only decision history</h4>
                      <ul>{draft.decisions.map((decision) => <li key={`${decision.createdAt}-${decision.contentHash}`}>{decision.decision.replaceAll("_", " ")} · {new Date(decision.createdAt).toLocaleString()}{decision.note ? ` · ${decision.note}` : ""}</li>)}</ul>
                    </div>
                  ) : null}
                </article>
              ))}
            </div>
          )}
        </section>

        <p><Link href="/integrations/meta">View connected Meta accounts</Link> · <Link href="/">Return to command center</Link></p>
      </section>
    </main>
  );
}
