import { signOut } from "@/app/login/actions";
import { AuthenticatedEditorialQueue } from "@/components/authenticated-editorial-queue";
import { EditorialCommandCenter } from "@/components/editorial-command-center";
import { requireCurrentProfile, roleCanReview } from "@/lib/auth";

const modules = [
  ["Authenticated Queue", "#authenticated-editorial-queue"],
  ["Breaking News", "#breaking-news"],
  ["Story Radar", "#story-radar"],
  ["Editorial Queue", "#editorial-queue"],
  ["Site Health", "#site-health"],
  ["Approval Queue", "#approval-queue"],
];

export const dynamic = "force-dynamic";

export default async function CommandCenterPage() {
  const profile = await requireCurrentProfile();

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
            External writes, WordPress publishing, and deployment actions remain disabled.
          </p>
        </header>

        <AuthenticatedEditorialQueue role={profile.role} />
        <EditorialCommandCenter />
      </section>
    </main>
  );
}
