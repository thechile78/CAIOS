import { getProjectManagerMetrics, getWorkItemsByStatus, projectWorkItems } from "@/lib/project-manager";
import styles from "./founder-dashboard.module.css";

const companyMetrics = [
  { label: "Editorial Velocity", value: "Human-gated", detail: "Every outbound story, draft, and social post remains approval-only." },
  { label: "Revenue Readiness", value: "Pre-scale", detail: "Track sponsorship, affiliate, and membership workstreams before launch commitments." },
  { label: "Audience Signals", value: "Pending", detail: "GA4 and Search Console connections are listed as founder follow-ups." },
  { label: "Risk Posture", value: "Guarded", detail: "No service keys or publishing credentials are exposed to the client." },
];

const operatingRhythms = [
  "Review priority stories and approval blockers before assigning newsroom work.",
  "Confirm source attribution, image rights, and WordPress draft readiness before public release.",
  "Use integration health to decide the next founder-level setup task.",
];

const founderControls = [
  { name: "Publishing Authority", status: "The Chile approval required", tone: "locked" },
  { name: "WordPress Dispatch", status: "Draft-only after approval", tone: "watch" },
  { name: "Social Distribution", status: "Private drafts until reviewed", tone: "watch" },
  { name: "Analytics Growth Loop", status: "Connection pending", tone: "neutral" },
];

const projectMetrics = getProjectManagerMetrics(projectWorkItems);
const workItemColumns = getWorkItemsByStatus(projectWorkItems);

export function FounderDashboard() {
  return (
    <section className={styles.founderDashboard} id="founder-dashboard" aria-labelledby="founder-dashboard-heading">
      <div className={styles.headerRow}>
        <div>
          <p className="eyebrow">Founder Dashboard v5</p>
          <h3 id="founder-dashboard-heading">Company Control Plane</h3>
          <p>
            Founder-level view of CAIOS readiness across editorial safety, monetization preparation,
            audience operations, and human approval gates.
          </p>
        </div>
        <span className="safety-badge safety-strong">No automatic publishing</span>
      </div>

      <div className={styles.metricGrid} aria-label="Company control metrics">
        {companyMetrics.map((metric) => (
          <article className={styles.metricCard} key={metric.label}>
            <span>{metric.label}</span>
            <strong>{metric.value}</strong>
            <small>{metric.detail}</small>
          </article>
        ))}
      </div>

      <div className={styles.controlGrid}>
        <article className={styles.controlPanel}>
          <h4>Founder Operating Rhythm</h4>
          <ol>
            {operatingRhythms.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ol>
        </article>

        <article className={styles.controlPanel}>
          <h4>Authority & Risk Controls</h4>
          <div className={styles.controlList}>
            {founderControls.map((control) => (
              <div className={styles.controlItem} key={control.name}>
                <strong>{control.name}</strong>
                <span className={styles[control.tone]}>{control.status}</span>
              </div>
            ))}
          </div>
        </article>
      </div>

      <div className={styles.projectManager} id="project-manager" aria-labelledby="project-manager-heading">
        <div className={styles.headerRow}>
          <div>
            <p className="eyebrow">Milestone 2</p>
            <h3 id="project-manager-heading">Project Manager</h3>
            <p>
              Kanban view for reusable CAIOS work items with approval-aware workflow, executive metrics,
              and GitHub linkage placeholders for future issue, branch, and pull request automation.
            </p>
          </div>
          <span className="safety-badge safety-strong">Human approval gate enforced</span>
        </div>

        <div className={styles.briefAndMetrics}>
          <article className={styles.founderBrief} aria-labelledby="founder-brief-heading">
            <h4 id="founder-brief-heading">Founder Brief</h4>
            <p>
              {projectMetrics.active} active workstreams, {projectMetrics.awaitingApproval} awaiting approval,
              and {projectMetrics.blocked} carrying blockers. Public publishing remains unavailable from this board.
            </p>
            <ul>
              <li>Prioritize Critical items in Founder Review before expanding dispatch or social workflows.</li>
              <li>Use GitHub placeholders to prepare issues and PRs without exposing credentials client-side.</li>
              <li>Only approved internal UI work can move to Approved; public content still needs The Chile.</li>
            </ul>
          </article>

          <div className={styles.executiveMetrics} aria-label="Project manager executive metrics">
            <article><span>Total work items</span><strong>{projectMetrics.total}</strong></article>
            <article><span>Awaiting approval</span><strong>{projectMetrics.awaitingApproval}</strong></article>
            <article><span>Blocked</span><strong>{projectMetrics.blocked}</strong></article>
            <article><span>GitHub placeholders</span><strong>{projectMetrics.githubPlaceholders}</strong></article>
          </div>
        </div>

        <div className={styles.kanbanBoard} aria-label="Approval-aware project Kanban board">
          {workItemColumns.map((column) => (
            <section className={styles.kanbanColumn} key={column.status} aria-labelledby={`column-${column.status.replaceAll(" ", "-").toLowerCase()}`}>
              <div className={styles.columnHeader}>
                <h4 id={`column-${column.status.replaceAll(" ", "-").toLowerCase()}`}>{column.status}</h4>
                <span>{column.items.length}</span>
              </div>
              <div className={styles.workItemList}>
                {column.items.map((item) => (
                  <article className={styles.workItemCard} key={item.id}>
                    <div className={styles.workItemTopline}>
                      <span>{item.id}</span>
                      <strong>{item.priority}</strong>
                    </div>
                    <h5>{item.title}</h5>
                    <p>{item.impact}</p>
                    <dl>
                      <div><dt>Owner</dt><dd>{item.owner}</dd></div>
                      <div><dt>Due</dt><dd>{item.dueLabel}</dd></div>
                      <div><dt>GitHub</dt><dd>{item.github.branchName ?? item.github.issueUrl ?? "Placeholder needed"}</dd></div>
                    </dl>
                    <div className={styles.approvalStrip} data-approved={item.approval.approved}>
                      <strong>{item.approval.approver}</strong>
                      <span>{item.approval.approved ? "Approved for internal work" : item.approval.note}</span>
                    </div>
                    {item.blockers.length > 0 ? <small>Blockers: {item.blockers.join(", ")}</small> : null}
                  </article>
                ))}
              </div>
            </section>
          ))}
        </div>
      </div>
    </section>
  );
}
