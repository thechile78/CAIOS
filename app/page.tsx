import { EditorialCommandCenter } from "@/components/editorial-command-center";
import { requireCurrentProfile, roleCanReview } from "@/lib/auth";
import { signOut } from "@/app/login/actions";

const modules = [
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
            <p>Newsroom OS v4.3</p>
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
          <h2>One secure control room for editorial intelligence, workflow, health, and approval.</h2>
          <p>
            Access is authenticated and role-aware. External writes, WordPress publishing,
            and deployment actions remain disabled.
          </p>
        </header>

        <EditorialCommandCenter />
      </section>
    </main>
  );
}
