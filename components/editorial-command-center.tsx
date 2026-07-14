import { alerts, kpis, siteHealth, stories, workflow } from "@/lib/newsroom";

interface KPI {
  label: string;
  value: number;
  detail: string;
}

interface Alert {
  id: number;
  severity: string;
  title: string;
  reason: string;
}

interface HealthItem {
  label: string;
  status: string;
  tone: string;
}

interface Story {
  id: number;
  score: number;
  headline: string;
  desk: string;
  sourceCount: number;
  stage: string;
  houstonRelevant: boolean;
}

function scoreClass(score: number) {
  if (score >= 90) return "score score-critical";
  if (score >= 80) return "score score-high";
  return "score";
}

export function EditorialCommandCenter() {
  return (
    <>
      <section className="kpi-grid" aria-label="Newsroom key metrics">
        {kpis.map((item: KPI) => (
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
              <h3>Breaking-News Alerts</h3>
            </div>
            <span className="safety-badge">Human review required</span>
          </div>

          <div className="alert-list">
            {alerts.map((alert: Alert) => (
              <div className="alert-item" key={alert.id}>
                <span className={`severity severity-${alert.severity.toLowerCase()}`}>{alert.severity}</span>
                <div>
                  <strong>{alert.title}</strong>
                  <p>{alert.reason}</p>
                </div>
                <button type="button" className="secondary-button">Review</button>
              </div>
            ))}
          </div>
        </article>

        <article className="panel" id="site-health">
          <div className="panel-heading">
            <div>
              <p className="eyebrow">Operational Status</p>
              <h3>Site Health</h3>
            </div>
          </div>
          <div className="health-list">
            {siteHealth.map((item: HealthItem) => (
              <div className="health-row" key={item.label}>
                <span>{item.label}</span>
                <strong className={`health-${item.tone}`}>{item.status}</strong>
              </div>
            ))}
          </div>
        </article>
      </section>

      <section className="panel" id="story-radar">
        <div className="panel-heading">
          <div>
            <p className="eyebrow">Prioritized Intelligence</p>
            <h3>AI Story Radar</h3>
          </div>
          <span className="safety-badge">Recommendations only</span>
        </div>

        <div className="story-table-wrap">
          <table className="story-table">
            <thead>
              <tr>
                <th>Score</th>
                <th>Story</th>
                <th>Desk</th>
                <th>Sources</th>
                <th>Stage</th>
                <th>Houston</th>
              </tr>
            </thead>
            <tbody>
              {stories.map((story: Story) => (
                <tr key={story.id}>
                  <td><span className={scoreClass(story.score)}>{story.score}</span></td>
                  <td><strong>{story.headline}</strong></td>
                  <td>{story.desk}</td>
                  <td>{story.sourceCount}</td>
                  <td><span className="stage-pill">{story.stage}</span></td>
                  <td>{story.houstonRelevant ? "Yes" : "No"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
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
          {workflow.map((stage: string, index: number) => (
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
          <p>Four stories are awaiting review. WordPress draft creation remains blocked until all verification, image-rights, SEO, and human-approval gates are complete.</p>
        </div>
        <button type="button" className="primary-button">Open Approval Queue</button>
      </section>
    </>
  );
}
