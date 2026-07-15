import type { ReactNode } from "react";

import { requireCurrentProfile } from "@/lib/auth";
import { getStoryActivity } from "@/lib/story-activity";

export const dynamic = "force-dynamic";

export default async function StoryLayout({ children, params }: { children: ReactNode; params: Promise<{ id: string }> }) {
  await requireCurrentProfile();
  const { id } = await params;
  const activity = await getStoryActivity(id);

  return (
    <>
      {children}
      <section style={{ maxWidth: 1200, margin: "0 auto 28px", padding: "0 28px" }}>
        <article className="panel">
          <div className="panel-heading">
            <div>
              <p className="eyebrow">Audit trail</p>
              <h3>Activity Timeline v1</h3>
            </div>
            <span className="safety-badge">Read only</span>
          </div>
          {activity.length ? (
            <ol style={{ listStyle: "none", margin: 0, padding: 0, display: "grid", gap: 12 }}>
              {activity.map((event) => (
                <li key={event.id} style={{ display: "grid", gridTemplateColumns: "14px 1fr", gap: 12, alignItems: "start" }}>
                  <span aria-hidden="true" style={{ width: 12, height: 12, marginTop: 5, borderRadius: 999, background: "#d71920" }} />
                  <div style={{ borderBottom: "1px solid #e5e7eb", paddingBottom: 12 }}>
                    <strong style={{ display: "block" }}>{event.label}</strong>
                    <p style={{ margin: "4px 0", color: "#6b7280", lineHeight: 1.45 }}>{event.description}</p>
                    <small style={{ color: "#6b7280" }}>{new Date(event.createdAt).toLocaleString()}</small>
                  </div>
                </li>
              ))}
            </ol>
          ) : (
            <p>No audited activity is available for this story yet.</p>
          )}
        </article>
      </section>
    </>
  );
}
