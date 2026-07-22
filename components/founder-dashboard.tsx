import {
  createProjectWorkItem,
  recordProjectWorkItemDecision,
  updateProjectWorkItemStatus,
} from "@/app/project-manager/actions";
import {
  getProjectManagerMetrics,
  getWorkItemsByStatus,
  workItemApprovers,
  workItemPriorities,
  workItemStatuses,
  workItemTypes,
  type WorkItem,
} from "@/lib/project-manager";
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

interface FounderDashboardProps {
  workItems: readonly WorkItem[];
  canManageProjects: boolean;
  statusMessage: string | null;
  errorMessage: string | null;
}

export function FounderDashboard({
  workItems,
  canManageProjects,
  statusMessage,
  errorMessage,
}: FounderDashboardProps) {
  const projectMetrics = getProjectManagerMetrics(workItems);
  const workItemColumns = getWorkItemsByStatus(workItems);

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
              Persisted Kanban view for reusable CAIOS work items with authenticated, approval-aware workflow,
              executive metrics, and GitHub linkage placeholders for future issue, branch, and pull request automation.
            </p>
          </div>
          <span className="safety-badge safety-strong">Human approval gate enforced</span>
        </div>

        {statusMessage ? <p className={styles.successNotice} role="status">{statusMessage}</p> : null}
        {errorMessage ? <p className={styles.errorNotice} role="alert">{errorMessage}</p> : null}

        {canManageProjects ? (
          <details className={styles.createPanel}>
            <summary>Create internal work item</summary>
            <form action={createProjectWorkItem} className={styles.createForm}>
              <label>Work key<input name="workKey" required maxLength={32} pattern="PM-[0-9]{3,}" placeholder="PM-150" /></label>
              <label>Title<input name="title" required maxLength={160} /></label>
              <label>Type<select name="workType" defaultValue="Product">{workItemTypes.map((value) => <option key={value}>{value}</option>)}</select></label>
              <label>Priority<select name="priority" defaultValue="Medium">{workItemPriorities.map((value) => <option key={value}>{value}</option>)}</select></label>
              <label>Owner<input name="ownerLabel" required maxLength={120} /></label>
              <label>Due<input name="dueLabel" required maxLength={120} placeholder="This sprint" /></label>
              <label>Approver<select name="approverLabel" defaultValue="Founder">{workItemApprovers.map((value) => <option key={value}>{value}</option>)}</select></label>
              <label className={styles.fullField}>Impact<textarea name="impact" required maxLength={1000} rows={3} /></label>
              <label className={styles.fullField}>Approval note<textarea name="approvalNote" required maxLength={1000} rows={2} /></label>
              <button className="primary-button" type="submit">Create in Backlog</button>
            </form>
          </details>
        ) : (
          <p className={styles.readOnlyNotice}>Project changes and decisions are restricted to administrators. Your view is read-only.</p>
        )}

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
                      <span>{item.approval.approved ? `Approved by ${item.approval.approvedBy ?? "recorded administrator"} for internal work only` : item.approval.note}</span>
                    </div>
                    {item.blockers.length > 0 ? <small>Blockers: {item.blockers.join(", ")}</small> : null}
                    {canManageProjects ? (
                      <div className={styles.workItemActions}>
                        <form action={updateProjectWorkItemStatus}>
                          <input type="hidden" name="workItemId" value={item.databaseId} />
                          <input type="hidden" name="expectedUpdatedAt" value={item.updatedAt} />
                          <label>
                            Move to
                            <select name="status" defaultValue={item.status === "Approved" ? "Ready" : item.status}>
                              {workItemStatuses.filter((status) => status !== "Approved").map((status) => (
                                <option key={status} value={status}>{status}</option>
                              ))}
                            </select>
                          </label>
                          <button type="submit">Update status</button>
                        </form>
                        {item.status === "Founder Review" ? (
                          <form action={recordProjectWorkItemDecision}>
                            <input type="hidden" name="workItemId" value={item.databaseId} />
                            <input type="hidden" name="expectedUpdatedAt" value={item.updatedAt} />
                            <label>Decision note<textarea name="note" maxLength={4000} rows={2} /></label>
                            <div className={styles.decisionButtons}>
                              <button type="submit" name="decision" value="approved">Approve internal work</button>
                              <button type="submit" name="decision" value="changes_requested">Request changes</button>
                              <button type="submit" name="decision" value="rejected">Reject</button>
                            </div>
                          </form>
                        ) : null}
                      </div>
                    ) : null}
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
