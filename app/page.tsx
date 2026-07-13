const modules = [
  ["Breaking News", "High-confidence alerts requiring human review"],
  ["Editorial Queue", "Discovery through WordPress draft approval"],
  ["Story Radar", "Trusted-source monitoring and clustering"],
  ["AI Editor", "Drafts, SEO, social, newsletter, and fact-check support"],
  ["Site Health", "Search, analytics, crawl, and uptime signals"],
  ["Approval Queue", "Final control before any public action"],
];

export default function CommandCenterPage() {
  return (
    <main className="shell">
      <aside className="sidebar">
        <div className="brand">
          <div className="mark">🌶️</div>
          <div>
            <h1>CAIOS</h1>
            <p>Newsroom OS v4.0</p>
          </div>
        </div>
        <nav>
          {modules.map(([name]) => <a href={`#${name.toLowerCase().replaceAll(" ", "-")}`} key={name}>{name}</a>)}
        </nav>
        <div className="rule"><strong>Operating Rule</strong><span>AI prepares. The Chile approves.</span></div>
      </aside>

      <section className="content">
        <header className="hero">
          <p className="eyebrow">Chilemaniacs Newsroom Command Center</p>
          <h2>One control room for the entire editorial operation.</h2>
          <p>v4.0 begins with a clean, testable application shell. No publishing automation is enabled.</p>
        </header>

        <section className="grid">
          {modules.map(([name, description]) => (
            <article id={name.toLowerCase().replaceAll(" ", "-")} key={name} className="card">
              <span className="status">Foundation</span>
              <h3>{name}</h3>
              <p>{description}</p>
            </article>
          ))}
        </section>

        <section className="workflow">
          <h3>Mandatory Editorial Workflow</h3>
          <p>Discovery → Verification → Clustering → Scoring → Research → Draft → Fact Check → SEO Review → Human Approval → WordPress Draft</p>
        </section>
      </section>
    </main>
  );
}
