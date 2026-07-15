type ScorecardCheck = {
  key: string;
  label: string;
  passed: boolean;
  detail: string;
};

type EditorialScorecardProps = {
  scorecard: {
    score: number;
    label: string;
    checks: ScorecardCheck[];
  };
};

export function EditorialScorecard({ scorecard }: EditorialScorecardProps) {
  return (
    <section className="panel scorecard-panel">
      <div className="panel-heading">
        <div>
          <p className="eyebrow">Live editorial diagnostics</p>
          <h3>Editorial Scorecard v1</h3>
        </div>
        <div className="scorecard-total" aria-label={`Readiness score ${scorecard.score} percent`}>
          <strong>{scorecard.score}%</strong>
          <span>{scorecard.label}</span>
        </div>
      </div>
      <div className="scorecard-grid">
        {scorecard.checks.map((check) => (
          <article className={`scorecard-check ${check.passed ? "scorecard-pass" : "scorecard-needs-work"}`} key={check.key}>
            <span className="scorecard-state">{check.passed ? "Pass" : "Needs work"}</span>
            <strong>{check.label}</strong>
            <p>{check.detail}</p>
          </article>
        ))}
      </div>
      <p className="editorial-form-note">The score is a workflow aid, not an approval decision. Human verification and the Approval Center remain authoritative.</p>
    </section>
  );
}
