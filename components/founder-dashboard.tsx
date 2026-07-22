import {
  activeWorkstream,
  approvalRequests,
  caiosProject,
  departments,
  founderPriorities,
} from "@/lib/company-control-plane";

const statusLabels = {
  healthy: "Healthy",
  attention: "Needs attention",
  blocked: "Blocked",
  idle: "Queued",
};

export function FounderDashboard() {
  const active = activeWorkstream();
  const priorities = founderPriorities(3);
  const blockers = departments.filter((department) => department.blocker);
  const completed = caiosProject.workstreams.filter((workstream) => workstream.status === "completed").length;
  const total = caiosProject.workstreams.length;
  const progress = Math.round((completed / total) * 100);

  return (
    <section id="founder-dashboard" aria-labelledby="founder-dashboard-title">
      <div className="founder-hero">
        <div>
          <p className="eyebrow">Founder Brief</p>
          <h2 id="founder-dashboard-title">One project. One active workstream. One next move.</h2>
          <p>{caiosProject.objective}</p>
        </div>
        <div className="founder-progress" aria-label={`${progress}% of workstreams completed`}>
          <strong>{progress}%</strong>
          <span>{completed} of {total} workstreams complete</span>
        </div>
      </div>

      <div className="kpi-grid founder-kpis">
        <article className="kpi-card">
          <span>Master project</span>
          <strong>1</strong>
          <small>{caiosProject.name}</small>
        </article>
        <article className="kpi-card">
          <span>Active workstreams</span>
          <strong>1</strong>
          <small>{active.name}</small>
        </article>
        <article className="kpi-card">
          <span>Founder approvals</span>
          <strong>{approvalRequests.length}</strong>
          <small>No external action occurs automatically</small>
        </article>
        <article className="kpi-card">
          <span>Department blockers</span>
          <strong>{blockers.length}</strong>
          <small>Queued blockers are sequencing controls</small>
        </article>
      </div>

      <div className="founder-grid">
        <article className="panel founder-active-panel">
          <div className="panel-heading">
            <div>
              <p className="eyebrow">Current focus</p>
              <h3>{active.name}</h3>
            </div>
            <span className="status-pill status-in-progress">In progress</span>
          </div>
          <dl className="founder-detail-list">
            <div><dt>Milestone</dt><dd>{active.milestone}</dd></div>
            <div><dt>Next action</dt><dd>{active.nextAction}</dd></div>
            <div><dt>Operating constraint</dt><dd>No later workstream begins until this milestone reaches its Definition of Done or the founder explicitly reprioritizes it.</dd></div>
          </dl>
        </article>

        <article className="panel">
          <div className="panel-heading">
            <div><p className="eyebrow">Decision queue</p><h3>Founder approvals</h3></div>
            <span className="safety-badge">Approval gated</span>
          </div>
          <div className="founder-stack">
            {approvalRequests.map((request) => (
              <div className="founder-card" key={request.id}>
                <strong>{request.title}</strong>
                <p>{request.reason}</p>
                <small>Proposed action: {request.proposedAction}</small>
              </div>
            ))}
          </div>
        </article>
      </div>

      <div className="founder-grid">
        <article className="panel">
          <div className="panel-heading">
            <div><p className="eyebrow">Priority order</p><h3>What happens next</h3></div>
          </div>
          <ol className="priority-list">
            {priorities.map((workstream) => (
              <li key={workstream.id}>
                <div>
                  <strong>{workstream.name}</strong>
                  <p>{workstream.nextAction}</p>
                </div>
                <span className={`status-pill status-${workstream.status.replaceAll("_", "-")}`}>{workstream.status.replaceAll("_", " ")}</span>
              </li>
            ))}
          </ol>
        </article>

        <article className="panel">
          <div className="panel-heading">
            <div><p className="eyebrow">Company view</p><h3>Department health</h3></div>
          </div>
          <div className="health-list">
            {departments.map((department) => (
              <div className="department-health" key={department.id}>
                <div>
                  <strong>{department.name}</strong>
                  <small>{department.activeWork}</small>
                </div>
                <span className={`department-status department-${department.status}`}>{statusLabels[department.status]}</span>
              </div>
            ))}
          </div>
        </article>
      </div>
    </section>
  );
}
