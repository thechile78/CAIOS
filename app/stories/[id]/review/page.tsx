import Link from "next/link";
import { notFound } from "next/navigation";

import { requireCurrentProfile, roleCanReview } from "@/lib/auth";
import { getEditorialReview } from "@/lib/editorial-review";
import { recordDecision, saveChecklist } from "./actions";

export const dynamic = "force-dynamic";

export default async function EditorialReviewPage({ params, searchParams }: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string; saved?: string; decision?: string }>;
}) {
  const [{ id }, query, profile] = await Promise.all([params, searchParams, requireCurrentProfile()]);
  const review = await getEditorialReview(id);
  if (!review) notFound();

  const canDecide = roleCanReview(profile.role);
  const isReviewable = review.status === "awaiting_approval";

  return (
    <main className="shell">
      <section className="content">
        <header className="hero">
          <p className="eyebrow">Editorial Review</p>
          <h1>{review.title}</h1>
          <p>Status: <strong>{review.status.replaceAll("_", " ")}</strong></p>
          <p><Link href="/">Return to command center</Link></p>
        </header>

        {query.error ? <p role="alert">{query.error}</p> : null}
        {query.saved ? <p>Checklist saved and audit event recorded.</p> : null}
        {query.decision ? <p>Decision recorded: {query.decision.replaceAll("_", " ")}.</p> : null}

        <section className="panel">
          <h2>Required editorial checklist</h2>
          <form action={saveChecklist}>
            <input type="hidden" name="storyId" value={review.id} />
            <input type="hidden" name="expectedUpdatedAt" value={review.updatedAt} />
            <label><input type="checkbox" name="sourcesVerified" defaultChecked={review.checklist.sourcesVerified} /> Sources verified</label>
            <label><input type="checkbox" name="factsVerified" defaultChecked={review.checklist.factsVerified} /> Facts verified</label>
            <label><input type="checkbox" name="rightsReviewed" defaultChecked={review.checklist.rightsReviewed} /> Image and media rights reviewed</label>
            <label><input type="checkbox" name="seoReviewed" defaultChecked={review.checklist.seoReviewed} /> SEO reviewed</label>
            <p>Human approval: <strong>{review.checklist.humanApproved ? "Recorded" : "Not recorded"}</strong></p>
            <button type="submit" disabled={review.checklist.humanApproved}>Save checklist</button>
          </form>
        </section>

        <section className="panel">
          <h2>Human decision</h2>
          {!canDecide ? <p>Your role can update checklist items but cannot approve or reject stories.</p> : null}
          {canDecide && !isReviewable ? <p>Decisions are available only when the story is awaiting approval.</p> : null}
          {canDecide && isReviewable ? (
            <form action={recordDecision}>
              <input type="hidden" name="storyId" value={review.id} />
              <input type="hidden" name="expectedUpdatedAt" value={review.updatedAt} />
              <label>Decision
                <select name="decision" defaultValue="changes_requested">
                  <option value="approved">Approve</option>
                  <option value="changes_requested">Request changes</option>
                  <option value="rejected">Reject</option>
                </select>
              </label>
              <label>Review note
                <textarea name="note" maxLength={4000} rows={6} />
              </label>
              <button type="submit">Record human decision</button>
            </form>
          ) : null}
        </section>

        <section className="panel">
          <h2>Decision history</h2>
          {review.decisions.length === 0 ? <p>No decisions have been recorded.</p> : (
            <ol>
              {review.decisions.map((item, index) => (
                <li key={`${item.createdAt}-${index}`}>
                  <strong>{item.decision.replaceAll("_", " ")}</strong> — {new Date(item.createdAt).toLocaleString()}
                  {item.note ? <p>{item.note}</p> : null}
                </li>
              ))}
            </ol>
          )}
        </section>
      </section>
    </main>
  );
}
