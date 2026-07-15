import Link from "next/link";

import type { AppRole } from "@/lib/auth";
import {
  listEditorialQueueStories,
  roleCanCreateStory,
} from "@/lib/editorial-repository";

interface AuthenticatedEditorialQueueProps {
  role: AppRole;
  status?: string | null;
}

export async function AuthenticatedEditorialQueue({
  role,
  status,
}: AuthenticatedEditorialQueueProps) {
  const stories = await listEditorialQueueStories(50, status);
  const filterLabel = status ? status.replaceAll("_", " ") : "all active stages";

  return (
    <section id="authenticated-editorial-queue" className="panel">
      <div className="panel-heading">
        <div>
          <p className="eyebrow">Authenticated data</p>
          <h3>Editorial Queue</h3>
          <small>Showing {filterLabel}</small>
        </div>
        <div className="queue-heading-actions">
          <span>{stories.length} stories</span>
          {status ? <Link className="secondary-button" href="/#authenticated-editorial-queue">Clear filter</Link> : null}
        </div>
      </div>

      {stories.length === 0 ? (
        <p>No stories are available for this workflow stage.</p>
      ) : (
        <div className="story-table-wrap editorial-queue-wrap">
          <table className="story-table editorial-queue-table">
            <colgroup>
              <col className="queue-story-column" />
              <col className="queue-desk-column" />
              <col className="queue-priority-column" />
              <col className="queue-status-column" />
              <col className="queue-updated-column" />
            </colgroup>
            <thead>
              <tr>
                <th>Story</th>
                <th>Desk</th>
                <th>Priority</th>
                <th>Status</th>
                <th>Updated</th>
              </tr>
            </thead>
            <tbody>
              {stories.map((story) => (
                <tr key={story.id}>
                  <td>
                    <strong>{story.title}</strong>
                    {story.summary ? <small className="queue-summary">{story.summary}</small> : null}
                    <Link className="secondary-button queue-inline-review" href={`/stories/${story.id}`}>
                      Review story
                    </Link>
                  </td>
                  <td>{story.desk}</td>
                  <td>{story.priority}</td>
                  <td>{story.status.replaceAll("_", " ")}</td>
                  <td>{new Date(story.updatedAt).toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <p>
        {roleCanCreateStory(role)
          ? "Story intelligence is review-only. Status changes remain gated behind the validated editorial write path."
          : "Your role has read-only access to this queue."}
      </p>
    </section>
  );
}
