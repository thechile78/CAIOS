import Link from "next/link";

import type { AppRole } from "@/lib/auth";
import {
  listEditorialQueueStories,
  roleCanCreateStory,
} from "@/lib/editorial-repository";

interface AuthenticatedEditorialQueueProps {
  role: AppRole;
}

export async function AuthenticatedEditorialQueue({
  role,
}: AuthenticatedEditorialQueueProps) {
  const stories = await listEditorialQueueStories();

  return (
    <section id="authenticated-editorial-queue" className="panel">
      <div className="panel-heading">
        <div>
          <p className="eyebrow">Authenticated data</p>
          <h3>Editorial Queue</h3>
        </div>
        <span>{stories.length} active stories</span>
      </div>

      {stories.length === 0 ? (
        <p>No active stories are available to this account.</p>
      ) : (
        <div className="story-table-wrap">
          <table className="story-table">
            <thead>
              <tr>
                <th>Story</th>
                <th>Desk</th>
                <th>Priority</th>
                <th>Status</th>
                <th>Updated</th>
                <th>Review</th>
              </tr>
            </thead>
            <tbody>
              {stories.map((story) => (
                <tr key={story.id}>
                  <td>
                    <strong>{story.title}</strong>
                    {story.summary ? <small style={{ display: "block", marginTop: 4 }}>{story.summary}</small> : null}
                  </td>
                  <td>{story.desk}</td>
                  <td>{story.priority}</td>
                  <td>{story.status.replaceAll("_", " ")}</td>
                  <td>{new Date(story.updatedAt).toLocaleString()}</td>
                  <td><Link className="secondary-button" href={`/stories/${story.id}`}>Open intelligence</Link></td>
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
