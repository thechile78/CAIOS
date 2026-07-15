import { runNewsDiscovery } from "@/app/discovery/actions";
import { signOut } from "@/app/login/actions";
import { AuthenticatedEditorialQueue } from "@/components/authenticated-editorial-queue";
import { EditorialCommandCenter } from "@/components/editorial-command-center";
import { requireCurrentProfile, roleCanReview } from "@/lib/auth";
import { roleCanCreateStory } from "@/lib/editorial-repository";

const modules = [
  ["Authenticated Queue", "#authenticated-editorial-queue"],
  ["News Discovery", "#news-discovery"],
  ["Breaking News", "#breaking-news"],
  ["Story Radar", "#story-radar"],
  ["Editorial Queue", "#editorial-queue"],
  ["Site Health", "#site-health"],
  ["Approval Queue", "#approval-queue"],
];

export const dynamic = "force-dynamic";

interface CommandCenterPageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function CommandCenterPage({ searchParams }: CommandCenterPageProps) {
  const profile = await requireCurrentProfile();
  const params = await searchParams;
  const discovery = typeof params.discovery === "string" ? params.discovery : null;
  const created = typeof params.created === "string" ? params.created : "0";
  const duplicates = typeof params.duplicates === "string" ? params.duplicates : "0";
  const errors = typeof params.errors === "string" ? params.errors : "0";

  return (
    <main className="shell">
      <aside className="sidebar">
        <div className="brand">
          <div className="mark">🌶️</div>
          <div>
            <h1>CAIOS</h1>
            <p>Newsroom OS v4.4</p>
          </div>
        </div>

        <nav>
          {modules.map(([name, href]) => (
            <a href={href} key={name}>{name}</a>
          ))}
        </nav>

        <div className="rule">
          <strong>{profile.displayName ?? profile.email ?? "Newsroom user"}</strong>
          <span>Role: {profile.role.replaceAll("_", " ")}</span>
          <span>{roleCanReview(profile.role) ? "Approval review enabled" : "Approval review restricted"}</span>
          <form action={signOut}>
            <button type="submit">Sign out</button>
          </form>
        </div>

        <div className="rule">
          <strong>Operating Rule</strong>
          <span>AI prepares. The Chile approves.</span>
        </div>
      </aside>

      <section className="content">
        <header className="hero">
          <p className="eyebrow">Chilemaniacs Newsroom Command Center</p>
          <h2>One secure control room for authenticated editorial intelligence, workflow, health, and approval.</h2>
          <p>
            The first live newsroom module reads through the authenticated Supabase session and row-level security.
            WordPress publishing and deployment actions remain disabled.
          </p>
        </header>

        <section className="panel" id="news-discovery">
          <div className="panel-heading">
            <div>
              <p className="eyebrow">Controlled ingestion</p>
              <h3>News Discovery Engine v1</h3>
            </div>
            <span className="safety-badge">Manual runs only</span>
          </div>
          <p>
            Checks the approved Houston and rock-news RSS registry, skips previously stored source URLs,
            and creates review-only stories in the discovered stage. Nothing is published or approved automatically.
          </p>
          {discovery === "complete" ? (
            <p role="status"><strong>Discovery complete:</strong> {created} created, {duplicates} duplicates skipped, {errors} feed errors.</p>
          ) : null}
          {discovery === "failed" ? <p role="alert">Discovery could not complete. No publishing action was taken.</p> : null}
          {discovery === "forbidden" ? <p role="alert">Your newsroom role cannot create discovered stories.</p> : null}
          {roleCanCreateStory(profile.role) ? (
            <form action={runNewsDiscovery}>
              <button type="submit" className="primary-button">Run approved-source discovery</button>
            </form>
          ) : (
            <small>Discovery is restricted to newsroom roles permitted to create stories.</small>
          )}
        </section>

        <AuthenticatedEditorialQueue role={profile.role} />
        <EditorialCommandCenter />
      </section>
    </main>
  );
}
