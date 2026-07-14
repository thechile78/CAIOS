import Link from "next/link";

import {
  listApprovalQueue,
  roleCanRequestHandoff,
} from "@/lib/approval-handoff";
import { requireCurrentProfile } from "@/lib/auth";
import { requestApprovedStoryHandoff } from "./actions";

interface PageProps {
  searchParams: Promise<{ error?: string; handoff?: string }>;
}

export default async function ApprovalQueuePage({ searchParams }: PageProps) {
  const profile = await requireCurrentProfile();
  const params = await searchParams;
  const stories = await listApprovalQueue();
  const canHandoff = roleCanRequestHandoff(profile.role);

  return (
    <main>
      <p><Link href="/">← Command center</Link></p>
      <h1>Approval Queue</h1>
      <p>Awaiting-review stories and approved stories ready for an internal packaging handoff.</p>

      {params.error ? <p role="alert">{params.error}</p> : null}
      {params.handoff === "requested" ? <p role="status">Internal handoff requested.</p> : null}

      {stories.length === 0 ? (
        <p>No stories are currently awaiting approval or approved.</p>
      ) : (
        <div>
          {stories.map((story) => (
            <article key={story.id}>
              <h2>{story.title}</h2>
              <p>{story.desk} · {story.priority} · {story.status}</p>
              <p>Updated: {new Date(story.updatedAt).toLocaleString()}</p>

              {story.status === "awaiting_approval" ? (
                <p><Link href={`/stories/${story.id}/review`}>Open human review</Link></p>
              ) : null}

              {story.handoffState ? (
                <p>Handoff state: {story.handoffState}</p>
              ) : story.status === "approved" && canHandoff ? (
                <form action={requestApprovedStoryHandoff}>
                  <input type="hidden" name="storyId" value={story.id} />
                  <input type="hidden" name="expectedUpdatedAt" value={story.updatedAt} />
                  <label>
                    Internal packaging note
                    <textarea name="note" maxLength={2000} rows={3} />
                  </label>
                  <button type="submit">Request internal handoff</button>
                </form>
              ) : story.status === "approved" ? (
                <p>Your role can view this approved story but cannot request its handoff.</p>
              ) : null}
            </article>
          ))}
        </div>
      )}

      <p>No WordPress draft or public publication is created from this queue.</p>
    </main>
  );
}
