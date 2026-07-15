import Link from "next/link";

import type { AppRole } from "@/lib/auth";
import {
  listEditorialQueueStories,
  roleCanCreateStory,
} from "@/lib/editorial-repository";

interface AuthenticatedEditorialQueueProps {
  role: AppRole;
  status?: string | null;
  query?: string | null;
  desk?: string | null;
  priority?: string | null;
  sort?: string | null;
}

export async function AuthenticatedEditorialQueue({
  role,
  status,
  query,
  desk,
  priority,
  sort,
}: AuthenticatedEditorialQueueProps) {
  const stories = await listEditorialQueueStories(50, { status, query, desk, priority, sort });
  const hasFilters = Boolean(status || query || desk || priority || (sort && sort !== "updated_desc"));
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
          {hasFilters ? <Link className="secondary-button" href="/#authenticated-editorial-queue">Clear filters</Link> : null}
        </div>
      </div>

      <form className="queue-filter-form" method="get" action="/">
        <label>
          Search
          <input name="q" type="search" defaultValue={query ?? ""} placeholder="Headline or summary" maxLength={100} />
        </label>
        <label>
          Desk
          <input name="desk" defaultValue={desk ?? ""} placeholder="Houston, Rock…" maxLength={60} />
        </label>
        <label>
          Priority
          <select name="priority" defaultValue={priority ?? ""}>
            <option value="">All priorities</option>
            <option value="breaking">Breaking</option>
            <option value="high">High</option>
            <option value="normal">Normal</option>
            <option value="low">Low</option>
          </select>
        </label>
        <label>
          Sort
          <select name="sort" defaultValue={sort ?? "updated_desc"}>
            <option value="updated_desc">Newest updated</option>
            <option value="updated_asc">Oldest updated</option>
            <option value="priority">Priority</option>
            <option value="title">Headline A–Z</option>
          </select>
        </label>
        {status ? <input type="hidden" name="status" value={status} /> : null}
        <button className="primary-button queue-filter-submit" type="submit">Apply filters</button>
      </form>

      {stories.length === 0 ? (
        <p>No stories match the current queue filters.</p>
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
          ? "Queue controls are view-only. Story changes remain gated behind the validated editorial write path."
          : "Your role has read-only access to this queue."}
      </p>
    </section>
  );
}
