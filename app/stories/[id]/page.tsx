import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";

import { requireCurrentProfile, roleCanEdit, roleCanReview } from "@/lib/auth";
import { formatHoustonDateTime } from "@/lib/date-time";
import { getApprovedStoryImage, searchOpenverseImages } from "@/lib/image-rights";
import { getStoryIntelligence } from "@/lib/story-intelligence";
import { getWordPressPublicationState } from "@/lib/wordpress-publication";
import { submitStoryForApprovalAction } from "./actions";
import { recordEditorialDecisionAction, saveEditorialChecklistAction } from "./approval-actions";
import { EditorialScorecard } from "./editorial-scorecard";
import { approveStoryImageAction } from "./image-rights-actions";

export const dynamic = "force-dynamic";

interface StoryPageProps {
  params: Promise<{ id: string }>;
  searchParams: Promise<{
    editorial_error?: string;
    editorial_saved?: string;
    approval_error?: string;
    checklist_saved?: string;
    decision_recorded?: string;
    publication_error?: string;
    published?: string;
    image_approved?: string;
    image_error?: string;
    image_query?: string;
  }>;
}

export default async function StoryIntelligencePage({ params, searchParams }: StoryPageProps) {
  const profile = await requireCurrentProfile();
  const { id } = await params;
  const notices = await searchParams;
  const intelligence = await getStoryIntelligence(id);
  if (!intelligence) notFound();

  const [publication, approvedImage, imageChoices] = await Promise.all([
    getWordPressPublicationState(id),
    getApprovedStoryImage(id),
    notices.image_query ? searchOpenverseImages(notices.image_query) : Promise.resolve([]),
  ]);
  const { story, sources, similarStories, checklist, approvals } = intelligence;
  const status = String(story.status);
  const editable = roleCanEdit(profile.role) && !["approved", "wordpress_draft", "published", "archived"].includes(status);
  const checklistEditable = (roleCanEdit(profile.role) || roleCanReview(profile.role)) && !["approved", "wordpress_draft", "published", "archived"].includes(status);
  const canDecide = roleCanReview(profile.role) && status === "awaiting_approval";
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
        : notices.approval_error === "image"
          ? "Approval requires a rights-cleared featured image or the approved branded fallback."
          : notices.approval_error
          ? "The approval action could not be completed."
          : null;
  const publicationErrorMessage = notices.publication_error
    ? "Your approval was recorded, but WordPress did not confirm publication. The story was not marked published. Try again after checking the WordPress connection."
    : null;
  const imageError = notices.image_error === "locked"
    ? "Image rights are locked after story approval."
    : notices.image_error === "https"
      ? "The image, source, and license links must use HTTPS."
      : notices.image_error === "commercial"
        ? "The image must explicitly allow commercial website use."
        : notices.image_error === "rights"
          ? "Complete license and attribution evidence is required."
          : notices.image_error
            ? "The image approval could not be recorded. Review every rights field."
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
      {publicationErrorMessage ? <div className="editorial-notice editorial-notice-error" role="alert">{publicationErrorMessage}</div> : null}
      {imageError ? <div className="editorial-notice editorial-notice-error" role="alert">{imageError}</div> : null}
      {notices.editorial_saved ? <div className="editorial-notice editorial-notice-success" role="status">Changes saved. Current stage: {notices.editorial_saved.replaceAll("_", " ")}.</div> : null}
      {notices.checklist_saved ? <div className="editorial-notice editorial-notice-success" role="status">Editorial checklist saved and audited.</div> : null}
      {notices.decision_recorded ? <div className="editorial-notice editorial-notice-success" role="status">Editorial decision recorded: {notices.decision_recorded.replaceAll("_", " ")}.</div> : null}
      {notices.image_approved ? <div className="editorial-notice editorial-notice-success" role="status">Featured image rights approved and audit evidence saved.</div> : null}
      {notices.published ? <div className="editorial-notice editorial-notice-success" role="status">Approved and published to WordPress successfully.</div> : null}

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
          <form action={submitStoryForApprovalAction} className="editorial-form">
            <input type="hidden" name="storyId" value={story.id} />
            <input type="hidden" name="expectedUpdatedAt" value={story.updated_at} />
            <label>Headline<input name="title" defaultValue={story.title} minLength={8} maxLength={220} required /></label>
            <div className="editorial-form-grid">
              <label>Desk<input name="desk" defaultValue={story.desk} maxLength={80} required /></label>
              <label>Priority<select name="priority" defaultValue={story.priority}><option value="breaking">Breaking</option><option value="high">High</option><option value="normal">Normal</option><option value="low">Low</option></select></label>
            </div>
            <label>Summary<textarea name="summary" defaultValue={story.summary ?? ""} rows={4} maxLength={1200} /></label>
            <label>Working notes / body<textarea name="body" defaultValue={story.body ?? ""} rows={9} maxLength={30000} /></label>
            <label>Social post to embed<input name="socialEmbedUrl" type="url" defaultValue={story.social_embed_url ?? ""} placeholder="Paste one X, Instagram, or YouTube post URL" /></label>
            <label>Story image URL<input name="imageUrl" type="url" defaultValue={story.image_url ?? ""} placeholder="Paste the approved HTTPS image URL" /></label>
            <fieldset className="approval-checklist-form">
              <legend>One-click editorial checklist</legend>
              <label><input type="checkbox" name="sourcesVerified" defaultChecked={checklist?.sources_verified ?? false} required /> Sources and attribution verified</label>
              <label><input type="checkbox" name="factsVerified" defaultChecked={checklist?.facts_verified ?? false} required /> Factual claims checked</label>
              <label><input type="checkbox" name="rightsReviewed" defaultChecked={checklist?.rights_reviewed ?? false} required /> Image and media rights reviewed</label>
              <label><input type="checkbox" name="seoReviewed" defaultChecked={checklist?.seo_reviewed ?? false} required /> Headline, summary, and SEO reviewed</label>
            </fieldset>
            <div className="editorial-action-row">
              <button className="primary-button" type="submit">Save and submit for approval</button>
            </div>
            <p className="editorial-form-note">One submission saves the story, media, checklist, and approval request. Publishing remains unavailable here.</p>
          </form>
        ) : <p>This record is read-only for your role or current workflow stage.</p>}
      </section>

      <section className="panel image-rights-panel" id="image-rights">
        <div className="panel-heading">
          <div><p className="eyebrow">Copyright-safe media</p><h3>Image Rights Gate</h3></div>
          <span className={`safety-badge ${approvedImage ? "image-rights-approved" : "safety-strong"}`}>
            {approvedImage ? "Approved" : "Required"}
          </span>
        </div>

        {approvedImage ? (
          <article className="approved-image-card">
            <Image
              src={approvedImage.imageUrl}
              alt={approvedImage.altText}
              width={720}
              height={405}
              unoptimized
            />
            <div>
              <h4>Approved featured image</h4>
              <p><strong>Creator:</strong> {approvedImage.creator}</p>
              <p><strong>License:</strong> {approvedImage.licenseName}</p>
              <p><strong>Credit:</strong> {approvedImage.attributionText}</p>
              <p><strong>Commercial use:</strong> confirmed · <strong>Modifications:</strong> {approvedImage.modificationsAllowed ? "allowed" : "not allowed"}</p>
              <p><a href={approvedImage.sourcePageUrl} target="_blank" rel="noreferrer">Open source record</a>{approvedImage.licenseUrl ? <> · <a href={approvedImage.licenseUrl} target="_blank" rel="noreferrer">Open license</a></> : null}</p>
            </div>
          </article>
        ) : (
          <p className="editorial-notice editorial-notice-error">
            Story approval is blocked until a reviewer approves one image below or records the official Chilemaniacs fallback.
          </p>
        )}

        {checklistEditable ? (
          <>
            <form method="get" className="image-search-form">
              <label htmlFor="image-query">Find up to three CC0 image choices</label>
              <div>
                <input id="image-query" name="image_query" defaultValue={notices.image_query ?? story.title} minLength={3} maxLength={120} required />
                <button className="secondary-button" type="submit">Search approved source</button>
              </div>
              <p>Automated search is restricted to Openverse results marked CC0. A reviewer still makes the final selection.</p>
            </form>

            {notices.image_query ? (
              imageChoices.length ? (
                <div className="image-choice-grid">
                  {imageChoices.map((choice) => (
                    <article className="image-choice-card" key={choice.id}>
                      <Image src={choice.thumbnailUrl} alt="" width={480} height={270} unoptimized />
                      <div>
                        <h4>{choice.title}</h4>
                        <p>{choice.creator} · {choice.licenseName}</p>
                        <p><a href={choice.sourcePageUrl} target="_blank" rel="noreferrer">Inspect source page</a> · <a href={choice.licenseUrl} target="_blank" rel="noreferrer">Inspect license</a></p>
                        <form action={approveStoryImageAction} className="editorial-form">
                          <input type="hidden" name="storyId" value={story.id} />
                          <input type="hidden" name="sourceType" value="openverse" />
                          <input type="hidden" name="imageUrl" value={choice.imageUrl} />
                          <input type="hidden" name="sourcePageUrl" value={choice.sourcePageUrl} />
                          <input type="hidden" name="creator" value={choice.creator} />
                          <input type="hidden" name="licenseName" value={choice.licenseName} />
                          <input type="hidden" name="licenseUrl" value={choice.licenseUrl} />
                          <input type="hidden" name="attributionText" value={choice.attributionText} />
                          <input type="hidden" name="retrievedAt" value={new Date().toISOString()} />
                          <input type="hidden" name="commercialUseAllowed" value="true" />
                          <input type="hidden" name="modificationsAllowed" value="true" />
                          <label>Alt text<input name="altText" defaultValue={`${story.title}. Image by ${choice.creator}.`} minLength={5} maxLength={500} required /></label>
                          <button className="primary-button" type="submit">Approve this image</button>
                        </form>
                      </div>
                    </article>
                  ))}
                </div>
              ) : <p>No eligible CC0 choices were returned. Try a broader search or record an official asset below.</p>
            ) : null}

            <details className="manual-image-rights">
              <summary>Record an owned image, official press asset, or branded fallback</summary>
              <form action={approveStoryImageAction} className="editorial-form">
                <input type="hidden" name="storyId" value={story.id} />
                <div className="editorial-form-grid">
                  <label>Source type
                    <select name="sourceType" required>
                      <option value="official_press">Official press kit</option>
                      <option value="owned">Chilemaniacs-owned image</option>
                      <option value="branded_fallback">Chilemaniacs branded fallback</option>
                      <option value="wordpress_photo_directory">WordPress Photo Directory</option>
                    </select>
                  </label>
                  <label>Creator / rights owner<input name="creator" maxLength={300} required /></label>
                </div>
                <label>Direct HTTPS image URL<input name="imageUrl" type="url" pattern="https://.*" maxLength={3000} required /></label>
                <label>Rights evidence or source-page URL<input name="sourcePageUrl" type="url" pattern="https://.*" maxLength={3000} required /></label>
                <div className="editorial-form-grid">
                  <label>License / permission name<input name="licenseName" maxLength={200} placeholder="Owned by Chilemaniacs, official press use, or license name" required /></label>
                  <label>License URL, if available<input name="licenseUrl" type="url" pattern="https://.*" maxLength={3000} /></label>
                </div>
                <label>Required credit line<input name="attributionText" maxLength={1000} required /></label>
                <label>Accessible alt text<input name="altText" maxLength={500} required /></label>
                <label><input type="checkbox" name="commercialUseAllowed" required /> I verified this asset permits commercial website use.</label>
                <label><input type="checkbox" name="modificationsAllowed" /> The permission or license allows modifications/cropping.</label>
                <input type="hidden" name="retrievedAt" value={new Date().toISOString()} />
                <button className="primary-button" type="submit">Approve rights record</button>
              </form>
            </details>
          </>
        ) : null}
      </section>

      <section className="panel approval-center-panel">
        <div className="panel-heading"><div><p className="eyebrow">Human approval boundary</p><h3>Approval Center v1</h3></div><span className="safety-badge">Audited decisions</span></div>
        <div className="approval-status-grid">
          <div><strong>Sources verified</strong><span>{checklist?.sources_verified ? "Complete" : "Required"}</span></div>
          <div><strong>Facts verified</strong><span>{checklist?.facts_verified ? "Complete" : "Required"}</span></div>
          <div><strong>Rights reviewed</strong><span>{checklist?.rights_reviewed ? "Complete" : "Required"}</span></div>
          <div><strong>SEO reviewed</strong><span>{checklist?.seo_reviewed ? "Complete" : "Required"}</span></div>
        </div>
        {checklistEditable && !editable ? (
          <form action={saveEditorialChecklistAction} className="approval-checklist-form">
            <input type="hidden" name="storyId" value={story.id} />
            <input type="hidden" name="expectedUpdatedAt" value={story.updated_at} />
            <label><input type="checkbox" name="sourcesVerified" defaultChecked={checklist?.sources_verified ?? false} /> I reviewed and verified the cited sources.</label>
            <label><input type="checkbox" name="factsVerified" defaultChecked={checklist?.facts_verified ?? false} /> I checked the factual claims against the available reporting.</label>
            <label><input type="checkbox" name="rightsReviewed" defaultChecked={checklist?.rights_reviewed ?? false} disabled={!approvedImage} /> I reviewed the approved image, attribution, and saved usage-rights evidence.</label>
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
              <button className="primary-button" type="submit" name="decision" value="approved">Approve &amp; Publish</button>
              <button className="secondary-button" type="submit" name="decision" value="changes_requested">Request changes</button>
              <button className="secondary-button" type="submit" name="decision" value="rejected">Reject to fact check</button>
            </div>
            <p className="editorial-form-note">This single click records your final human approval and immediately publishes the reviewed article to WordPress.</p>
          </form>
        ) : <p>{status === "approved" ? "This story has a recorded human approval." : "Decision controls become available to reviewers when the story reaches awaiting approval."}</p>}
        {approvals.length ? <div className="approval-history"><h4>Decision history</h4><ul>{approvals.map((approval) => <li key={approval.id}><strong>{String(approval.decision).replaceAll("_", " ")}</strong> · {formatHoustonDateTime(approval.created_at)}{approval.note ? ` — ${approval.note}` : ""}</li>)}</ul></div> : null}
      </section>

      <section className="panel wordpress-bridge-panel">
        <div className="panel-heading"><div><p className="eyebrow">Approval-gated delivery</p><h3>WordPress Publication</h3></div><span className="safety-badge safety-strong">Human approved</span></div>
        <div className="wordpress-bridge-grid">
          <div><strong>Editorial status</strong><span>{status.replaceAll("_", " ")}</span></div>
          <div><strong>WordPress state</strong><span>{publication?.state ?? "Not requested"}</span></div>
          <div><strong>WordPress post ID</strong><span>{publication?.externalId ?? "Not assigned"}</span></div>
          <div><strong>Updated</strong><span>{publication ? formatHoustonDateTime(publication.updatedAt) : "—"}</span></div>
        </div>
        {publication?.externalUrl ? <p><a className="primary-button" href={publication.externalUrl} target="_blank" rel="noreferrer">Open live WordPress article</a></p> : null}
        {!publication ? <p>Nothing is sent to WordPress until a reviewer clicks Approve &amp; Publish.</p> : null}
        {publication?.state === "failed" ? <p className="editorial-notice editorial-notice-error">WordPress did not confirm publication. CAIOS did not mark this story published.</p> : null}
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
