import Link from "next/link";

import { requireCurrentProfile, roleCanEdit, roleCanReview } from "@/lib/auth";
import { listMediaPackages } from "@/lib/media-packages";
import { isCurrentUserFinalApprover, listSocialDrafts } from "@/lib/social-drafts";

import { PrivateMediaUploader } from "./private-media-uploader";

import {
  authorizePrivateMediaUpload,
  createMediaSocialDraft,
  createSocialDraft,
  finalizePrivateMediaUpload,
  importMediaPackage,
  recordSocialDraftDecision,
  submitSocialDraftForReview,
} from "./actions";

export const dynamic = "force-dynamic";

interface SocialDraftsPageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export const maxDuration = 300;

function readParam(value: string | string[] | undefined): string | null {
  return typeof value === "string" ? value : null;
}

export default async function SocialDraftsPage({ searchParams }: SocialDraftsPageProps) {
  const profile = await requireCurrentProfile();
  const params = await searchParams;
  const [drafts, mediaPackages, canFinalApprove] = await Promise.all([
    listSocialDrafts(),
    listMediaPackages(),
    isCurrentUserFinalApprover(),
  ]);
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
        {readParam(params.media_imported) ? <p className="editorial-notice editorial-notice-success" role="status">Sanitized media package imported. No video was uploaded.</p> : null}
        {readParam(params.upload_authorized) ? <p className="editorial-notice editorial-notice-success" role="status">One resumable private-review session is authorized for up to 24 hours. This does not authorize publication.</p> : null}
        {readParam(params.upload_finalized) ? <p className="editorial-notice editorial-notice-success" role="status">Private-review objects verified. The package can now be attached to a social draft.</p> : null}
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
            <div className="panel-heading">
              <div><p className="eyebrow">Media Studio bridge</p><h2>Import a verified package</h2></div>
              <span className="safety-badge">Metadata first</span>
            </div>
            <form action={importMediaPackage} className="editorial-form">
              <label>Media Studio package<input name="packageFile" type="file" accept="application/json,.json" required /></label>
              <label>Rights note<textarea name="rightsNote" maxLength={2000} rows={3} placeholder="Who authorized the captured performance or media use?" /></label>
              <label><input name="rightsAttested" type="checkbox" required /> I confirm I reviewed the media, music, performance, and platform usage rights.</label>
              <p className="editorial-form-note">This imports sanitized hashes and QA metadata only. It excludes local file paths and does not upload a video.</p>
              <button className="primary-button" type="submit">Import private media package</button>
            </form>
          </section>
        ) : null}

        <section className="panel">
          <div className="panel-heading"><div><p className="eyebrow">Private media intake</p><h2>Media packages</h2></div></div>
          {mediaPackages.length === 0 ? <p>No Media Studio packages have been imported.</p> : (
            <div className="social-draft-list">
              {mediaPackages.map((mediaPackage) => (
                <article className="social-draft-card" key={mediaPackage.id}>
                  <div className="panel-heading">
                    <div>
                      <h3>{mediaPackage.title}</h3>
                      <p>{mediaPackage.status.replaceAll("_", " ")} · Job {mediaPackage.localJobId}</p>
                    </div>
                    <span className="safety-badge">{mediaPackage.qaStatus === "verified" ? "QA verified" : "Needs QA"}</span>
                  </div>
                  <p className="editorial-form-note">Package hash: <code>{mediaPackage.packageHash}</code></p>
                  <p className="editorial-form-note">Rights: {mediaPackage.rightsAttested ? "attested" : "not attested"}{mediaPackage.rightsNote ? ` · ${mediaPackage.rightsNote}` : ""}</p>
                  <div className="media-artifact-grid">
                    {mediaPackage.artifacts.map((artifact) => (
                      <div className="media-artifact-card" key={artifact.id}>
                        <strong>{artifact.platformProfile.replaceAll("_", " ")}</strong>
                        <p>{artifact.width}×{artifact.height} · {(artifact.durationMs / 1000).toFixed(1)}s · Audio {artifact.audioChoice}</p>
                        <p>{artifact.uploadStatus} · {(artifact.byteSize / 1_048_576).toFixed(1)} MB</p>
                        {artifact.previewUrl ? <video controls preload="metadata" src={artifact.previewUrl}>Private video preview</video> : null}
                        <p className="editorial-form-note">SHA-256: <code>{artifact.sha256}</code></p>
                      </div>
                    ))}
                  </div>

                  {canFinalApprove && ["imported", "private_upload_authorized"].includes(mediaPackage.status) && !mediaPackage.activeAuthorizationId ? (
                    <form action={authorizePrivateMediaUpload} className="editorial-form approval-decision-form">
                      <input type="hidden" name="packageId" value={mediaPackage.id} />
                      <input type="hidden" name="expectedUpdatedAt" value={mediaPackage.updatedAt} />
                      <label><input name="privateUploadAcknowledged" type="checkbox" required /> Authorize these exact hashes for temporary private CAIOS review upload only.</label>
                      <button className="secondary-button" type="submit">Authorize private review upload</button>
                    </form>
                  ) : null}

                  {canFinalApprove && mediaPackage.activeAuthorizationId ? (
                    <div className="editorial-notice">
                      <p>This exact resumable upload session and trusted verification expire {new Date(mediaPackage.activeAuthorizationExpiresAt as string).toLocaleString()}.</p>
                      <PrivateMediaUploader artifacts={mediaPackage.artifacts} />
                      <form action={finalizePrivateMediaUpload}>
                        <input type="hidden" name="authorizationId" value={mediaPackage.activeAuthorizationId} />
                        <button className="secondary-button" type="submit">Verify completed private upload on server</button>
                      </form>
                    </div>
                  ) : null}

                  {canEdit && mediaPackage.status === "ready_for_review" ? (
                    <form action={createMediaSocialDraft} className="editorial-form approval-decision-form">
                      <input type="hidden" name="packageId" value={mediaPackage.id} />
                      <label>Internal title<input name="title" defaultValue={mediaPackage.title} maxLength={160} required /></label>
                      <label>Facebook caption<textarea name="facebookCaption" maxLength={5000} rows={5} /></label>
                      <label>Instagram caption<textarea name="instagramCaption" maxLength={2200} rows={5} /></label>
                      <button className="primary-button" type="submit">Create hash-bound social draft</button>
                    </form>
                  ) : null}
                </article>
              ))}
            </div>
          )}
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
                  {draft.mediaPackageId ? <p className="editorial-form-note">Media package: <code>{draft.mediaPackageId}</code> · Approval is bound to the exact artifact hashes.</p> : null}
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
                        {canFinalApprove ? <button className="primary-button" name="decision" value="approved" type="submit">Approve this exact draft</button> : null}
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
