import { getNewsroomDashboardSnapshot } from "@/lib/editorial-repository";

const workflow = [
  "Discovery",
  "Research",
  "Fact Check",
  "Drafting",
  "SEO Review",
  "Asset Review",
  "Human Approval",
  "WordPress Draft",
];

export async function EditorialCommandCenter() {
  const snapshot = await getNewsroomDashboardSnapshot();

  const kpis = [
    {
      label: "Stories in Queue",
      value: String(snapshot.activeStories),
      detail: "Live authenticated count",
    },
    {
      label: "High Priority",
      value: String(snapshot.highPriorityStories),
      detail: "Breaking and high-priority stories",
    },
    {
      label: "Awaiting Approval",
      value: String(snapshot.awaitingApproval),
      detail: "Human review required",
    },
    {
      label: "Source Health",
      value:
        snapshot.sourceHealthPercent === null
          ? "No data"
          : `${snapshot.sourceHealthPercent}%`,
      detail: `${snapshot.verifiedSources} of ${snapshot.totalSources} sources verified`,
    },
  ];

  return (
    <>
      <section className="kpi-grid" aria-label="Newsroom key metrics">
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
                    <p>
                      {story.desk} desk · {story.status.replaceAll("_", " ")} · Updated {new Date(story.updatedAt).toLocaleString()}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </article>

        <article className="panel" id="site-health">
          <div className="panel-heading">
            <div>
              <p className="eyebrow">Operational Status</p>
              <h3>Integration Health</h3>
            </div>
          </div>
          <div className="health-list">
            <div className="health-row">
              <span>Supabase Auth</span>
              <strong className="health-good">Connected</strong>
            </div>
            <div className="health-row">
              <span>Authenticated Database</span>
              <strong className="health-good">Connected</strong>
            </div>
            <div className="health-row">
              <span>WordPress Draft Dispatch</span>
              <strong className="health-warning">Approval-gated</strong>
            </div>
            <div className="health-row">
              <span>Search Console</span>
              <strong className="health-warning">Not connected</strong>
            </div>
            <div className="health-row">
              <span>Analytics</span>
              <strong className="health-warning">Not connected</strong>
            </div>
          </div>
        </article>
      </section>

      <section className="panel" id="story-radar">
        <div className="panel-heading">
          <div>
            <p className="eyebrow">Live Editorial State</p>
            <h3>Newsroom Radar</h3>
          </div>
          <span className="safety-badge">Authenticated database only</span>
        </div>

        <p>
          AI discovery and external-feed ingestion remain disabled until source governance,
          duplication controls, and human-review requirements are configured. Current values
          come only from the protected CAIOS database.
        </p>
      </section>

      <section className="panel" id="editorial-queue">
        <div className="panel-heading">
          <div>
            <p className="eyebrow">Mandatory Control Path</p>
            <h3>Editorial Workflow</h3>
          </div>
          <span className="safety-badge safety-strong">No auto-publish</span>
        </div>

        <ol className="workflow-track">
          {workflow.map((stage, index) => (
            <li className={stage === "Human Approval" ? "approval-stage" : ""} key={stage}>
              <span>{index + 1}</span>
              <strong>{stage}</strong>
            </li>
          ))}
        </ol>
      </section>

      <section className="panel approval-panel" id="approval-queue">
        <div>
          <p className="eyebrow">Final Editorial Authority</p>
          <h3>Approval Queue</h3>
          <p>
            {snapshot.awaitingApproval === 0
              ? "No stories are currently awaiting approval. WordPress draft creation remains blocked until a story completes verification, image-rights, SEO, and human-approval gates."
              : `${snapshot.awaitingApproval} ${snapshot.awaitingApproval === 1 ? "story is" : "stories are"} awaiting human approval. No story can create a WordPress draft until all required gates are complete.`}
          </p>
        </div>
      </section>
    </>
  );
}
