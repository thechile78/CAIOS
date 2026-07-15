import Link from "next/link";

import { getNewsroomDashboardSnapshot } from "@/lib/editorial-repository";

export async function EditorialCommandCenter() {
  const snapshot = await getNewsroomDashboardSnapshot();

  const kpis = [
    { label: "Stories in Queue", value: String(snapshot.activeStories), detail: "All non-archived stories" },
    { label: "High Priority", value: String(snapshot.highPriorityStories), detail: "Breaking and high priority" },
    { label: "Awaiting Approval", value: String(snapshot.awaitingApproval), detail: "Human decision required" },
    { label: "WordPress Drafts", value: String(snapshot.wordpressDrafts), detail: "Successfully dispatched drafts" },
    { label: "Published", value: String(snapshot.publishedStories), detail: "Stories marked published" },
    {
      label: "Source Health",
      value: snapshot.sourceHealthPercent === null ? "No data" : `${snapshot.sourceHealthPercent}%`,
      detail: `${snapshot.verifiedSources} of ${snapshot.totalSources} sources verified`,
    },
  ];

  return (
    <>
      <section className="panel newsroom-v2-panel" id="story-radar">
        <div className="panel-heading">
          <div>
            <p className="eyebrow">Newsroom Dashboard v2</p>
            <h3>Workflow Command Center</h3>
          </div>
          <span className="safety-badge">Live authenticated metrics</span>
        </div>
        <div className="workflow-filter-grid">
          {snapshot.workflowCounts.map((stage) => (
            <Link
              className="workflow-filter-card"
              href={`/?status=${stage.status}#authenticated-editorial-queue`}
              key={stage.status}
            >
              <strong>{stage.count}</strong>
              <span>{stage.label}</span>
              <small>Open filtered queue</small>
            </Link>
          ))}
        </div>
      </section>

      <section className="kpi-grid newsroom-kpi-grid" aria-label="Newsroom key metrics">
        {kpis.map((item) => (
          <article className="kpi-card" key={item.label}>
            <span>{item.label}</span>
            <strong>{item.value}</strong>
            <small>{item.detail}</small>
          </article>
        ))}
      </section>

      <section className="dashboard-grid">
        <article className="panel panel-wide" id="breaking-news">
          <div className="panel-heading">
            <div>
              <p className="eyebrow">Immediate Review</p>
              <h3>Priority Story Alerts</h3>
            </div>
            <span className="safety-badge">Human review required</span>
          </div>
          {snapshot.priorityStories.length === 0 ? (
            <p>No breaking or high-priority stories are currently in the authenticated queue.</p>
          ) : (
            <div className="alert-list">
              {snapshot.priorityStories.map((story) => (
                <div className="alert-item" key={story.id}>
                  <span className={`severity severity-${story.priority === "breaking" ? "critical" : "high"}`}>
                    {story.priority}
                  </span>
                  <div>
                    <strong>{story.title}</strong>
                    <p>{story.desk} desk · {story.status.replaceAll("_", " ")} · Updated {new Date(story.updatedAt).toLocaleString()}</p>
                  </div>
                  <Link className="secondary-button" href={`/stories/${story.id}`}>Review</Link>
                </div>
              ))}
            </div>
          )}
        </article>

        <article className="panel" id="site-health">
          <div className="panel-heading"><div><p className="eyebrow">Operational Status</p><h3>Integration Health</h3></div></div>
          <div className="health-list">
            <div className="health-row"><span>Supabase Auth</span><strong className="health-good">Connected</strong></div>
            <div className="health-row"><span>Authenticated Database</span><strong className="health-good">Connected</strong></div>
            <div className="health-row"><span>Discovery Engine</span><strong className="health-good">Manual ready</strong></div>
            <div className="health-row"><span>WordPress Draft Dispatch</span><strong className="health-warning">Approval-gated</strong></div>
            <div className="health-row"><span>Search Console</span><strong className="health-warning">Not connected</strong></div>
            <div className="health-row"><span>Analytics</span><strong className="health-warning">Not connected</strong></div>
          </div>
        </article>
      </section>

      <section className="panel approval-panel" id="approval-queue">
        <div>
          <p className="eyebrow">Final Editorial Authority</p>
          <h3>Approval Queue</h3>
          <p>
            {snapshot.awaitingApproval === 0
              ? "No stories are currently awaiting approval. WordPress draft creation remains blocked until all editorial gates and human approval are complete."
              : `${snapshot.awaitingApproval} ${snapshot.awaitingApproval === 1 ? "story is" : "stories are"} awaiting human approval.`}
          </p>
        </div>
        <Link className="primary-button" href="/?status=awaiting_approval#authenticated-editorial-queue">Open approval queue</Link>
      </section>
    </>
  );
}
