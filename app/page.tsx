import { runNewsDiscovery } from "@/app/discovery/actions";
import { signOut } from "@/app/login/actions";
import { AuthenticatedEditorialQueue } from "@/components/authenticated-editorial-queue";
import { EditorialCommandCenter } from "@/components/editorial-command-center";
import { FounderDashboard } from "@/components/founder-dashboard";
import { requireCurrentProfile, roleCanAdminister, roleCanReview } from "@/lib/auth";
import { roleCanCreateStory } from "@/lib/editorial-repository";
import { listProjectWorkItems } from "@/lib/project-manager-repository";

const modules = [
  ["Founder Dashboard", "#founder-dashboard"],
  ["Project Manager", "#project-manager"],
  ["Command Center", "#story-radar"],
  ["Editorial Queue", "#authenticated-editorial-queue"],
  ["News Discovery", "#news-discovery"],
  ["Priority Alerts", "#breaking-news"],
  ["Site Health", "#site-health"],
  ["Approval Queue", "#approval-queue"],
  ["Social Accounts", "/integrations/meta"],
  ["Social Drafts", "/social-drafts"],
];

export const dynamic = "force-dynamic";

interface CommandCenterPageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

function stringParam(value: string | string[] | undefined): string | null {
  return typeof value === "string" ? value : null;
}

export default async function CommandCenterPage({ searchParams }: CommandCenterPageProps) {
  const profile = await requireCurrentProfile();
  const [params, projectWorkItems] = await Promise.all([searchParams, listProjectWorkItems()]);
  const discovery = stringParam(params.discovery);
  const created = stringParam(params.created) ?? "0";
  const duplicates = stringParam(params.duplicates) ?? "0";
  const errors = stringParam(params.errors) ?? "0";
  const status = stringParam(params.status);
  const query = stringParam(params.q);
  const desk = stringParam(params.desk);
  const priority = stringParam(params.priority);
  const sort = stringParam(params.sort);
  const projectStatus = stringParam(params.project_status);
  const projectError = stringParam(params.project_error);

  return (
    <main className="shell">
      <aside className="sidebar">
        <div className="brand">
          <div className="mark">🌶️</div>
          <div><h1>CAIOS</h1><p>Newsroom OS v5</p></div>
        </div>

        <nav>
          {modules.map(([name, href]) => <a href={href} key={name}>{name}</a>)}
        </nav>

        <div className="rule user-rule">
          <strong>{profile.displayName ?? profile.email ?? "Newsroom user"}</strong>
          <span>Role: {profile.role.replaceAll("_", " ")}</span>
          <span>{roleCanReview(profile.role) ? "Approval review enabled" : "Approval review restricted"}</span>
          <form action={signOut}><button type="submit">Sign out</button></form>
        </div>

        <div className="rule operating-rule">
          <strong>Operating Rule</strong>
          <span>AI prepares. The Chile approves.</span>
        </div>
      </aside>

      <section className="content">
        <header className="hero">
          <p className="eyebrow">Chilemaniacs Newsroom Command Center</p>
          <h2>Founder control, live workflow visibility, authenticated editorial review, and approval-gated delivery.</h2>
          <p>The v5 Command Center brings founder-level company controls into the protected newsroom dashboard. No story or social content can publish automatically.</p>
        </header>

        <FounderDashboard
          workItems={projectWorkItems}
          canManageProjects={roleCanAdminister(profile.role)}
          statusMessage={projectStatus}
          errorMessage={projectError}
        />
        <EditorialCommandCenter />
        <AuthenticatedEditorialQueue
          role={profile.role}
          status={status}
          query={query}
          desk={desk}
          priority={priority}
          sort={sort}
        />

        <section className="panel" id="news-discovery">
          <div className="panel-heading">
            <div><p className="eyebrow">Controlled ingestion</p><h3>News Discovery Engine v1</h3></div>
            <span className="safety-badge">Manual runs only</span>
          </div>
          <p>Checks the approved Houston and rock-news RSS registry, skips stored source URLs, and creates review-only stories in the discovered stage.</p>
          {discovery === "complete" ? <p role="status"><strong>Discovery complete:</strong> {created} created, {duplicates} duplicates skipped, {errors} feed errors.</p> : null}
          {discovery === "failed" ? <p role="alert">Discovery could not complete. No publishing action was taken.</p> : null}
          {discovery === "forbidden" ? <p role="alert">Your newsroom role cannot create discovered stories.</p> : null}
          {roleCanCreateStory(profile.role) ? (
            <form action={runNewsDiscovery}><button type="submit" className="primary-button">Run approved-source discovery</button></form>
          ) : <small>Discovery is restricted to newsroom roles permitted to create stories.</small>}
        </section>
      </section>
    </main>
  );
}
