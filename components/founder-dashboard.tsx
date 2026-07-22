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
    </section>
  );
}
