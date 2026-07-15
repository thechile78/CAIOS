import Link from "next/link";
import { notFound } from "next/navigation";

import { requireCurrentProfile } from "@/lib/auth";
import { getStoryIntelligence } from "@/lib/story-intelligence";

export const dynamic = "force-dynamic";

export default async function StoryIntelligencePage({ params }: { params: Promise<{ id: string }> }) {
  await requireCurrentProfile();
  const { id } = await params;
  const intelligence = await getStoryIntelligence(id);
  if (!intelligence) notFound();

  const { story, sources, similarStories } = intelligence;

  return (
    <main className="content" style={{ marginLeft: 0, maxWidth: 1200, marginInline: "auto" }}>
      <p><Link href="/">← Back to newsroom</Link></p>
      <header className="hero">
        <p className="eyebrow">Story Intelligence v1 · Review only</p>
        <h2>{story.title}</h2>
        <p>{story.desk} · {String(story.status).replaceAll("_", " ")} · Current priority: {story.priority}</p>
      </header>

      <section className="kpi-grid">
        <article className="kpi-card"><span>Confidence</span><strong>{intelligence.confidence}%</strong><small>Source-based heuristic, not a factual guarantee</small></article>
        <article className="kpi-card"><span>Houston relevance</span><strong>{intelligence.houstonRelevant ? "Yes" : "No"}</strong><small>Requires human confirmation</small></article>
        <article className="kpi-card"><span>Suggested priority</span><strong>{intelligence.recommendedPriority}</strong><small>Recommendation only</small></article>
        <article className="kpi-card"><span>Sources</span><strong>{sources.length}</strong><small>{intelligence.verificationStatus}</small></article>
      </section>

      <section className="dashboard-grid">
        <article className="panel panel-wide">
          <p className="eyebrow">5-second briefing</p>
          <h3>{intelligence.briefing}</h3>
          <p>{intelligence.whyItMatters}</p>
        </article>
        <article className="panel">
          <p className="eyebrow">Editorial safeguards</p>
          <p>No AI-generated claim is treated as verified. Review the original source, confirm facts, and check image rights before advancing this story.</p>
        </article>
      </section>

      <section className="panel">
        <div className="panel-heading"><div><p className="eyebrow">Source attribution</p><h3>Original reporting</h3></div></div>
        {sources.length ? (
          <div className="alert-list">{sources.map((source) => (
            <div className="alert-item" key={source.id}>
              <span className={`severity ${source.verified ? "severity-high" : ""}`}>{source.verified ? "Verified" : "Unverified"}</span>
              <div><strong>{source.publisher}</strong><p>{source.title ?? source.url}</p></div>
              <a className="secondary-button" href={source.url} target="_blank" rel="noreferrer">Open source</a>
            </div>
          ))}</div>
        ) : <p>No source records are attached.</p>}
      </section>

      <section className="panel">
        <p className="eyebrow">Drafting assistance</p>
        <h3>Suggested headline</h3><p>{intelligence.suggestedHeadline}</p>
        <h3>Meta description</h3><p>{intelligence.metaDescription}</p>
      </section>

      <section className="panel">
        <p className="eyebrow">Similarity check</p>
        <h3>Potentially related stories</h3>
        {similarStories.length ? <ul>{similarStories.map((item) => <li key={item.id}><Link href={`/stories/${item.id}`}>{item.title}</Link> — {Math.round(item.similarity * 100)}% title overlap</li>)}</ul> : <p>No meaningful title overlap found in the active queue.</p>}
      </section>
    </main>
  );
}
