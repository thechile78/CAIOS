import { EditorialCommandCenter } from "@/components/editorial-command-center";

const modules = [
  ["Breaking News", "#breaking-news"],
  ["Story Radar", "#story-radar"],
  ["Editorial Queue", "#editorial-queue"],
  ["Site Health", "#site-health"],
  ["Approval Queue", "#approval-queue"],
];

export default function CommandCenterPage() {
  return (
    <main className="shell">
      <aside className="sidebar">
        <div className="brand">
          <div className="mark">🌶️</div>
          <div>
            <h1>CAIOS</h1>
            <p>Newsroom OS v4.0.2</p>
          </div>
        </div>

        <nav>
          {modules.map(([name, href]) => (
            <a href={href} key={name}>{name}</a>
          ))}
        </nav>

        <div className="rule">
          <strong>Operating Rule</strong>
          <span>AI prepares. The Chile approves.</span>
        </div>
      </aside>

      <section className="content">
        <header className="hero">
          <p className="eyebrow">Chilemaniacs Newsroom Command Center</p>
          <h2>One live control room for editorial intelligence, workflow, health, and approval.</h2>
          <p>
            This milestone introduces a typed, testable command-center MVP using safe mock data.
            No external writes, WordPress publishing, or deployment actions are enabled.
          </p>
        </header>

        <EditorialCommandCenter />
      </section>
    </main>
  );
}
