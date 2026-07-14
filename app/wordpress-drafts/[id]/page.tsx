import { notFound } from "next/navigation";

import { requireCurrentProfile } from "@/lib/auth";
import { getWordPressDraftPackage } from "@/lib/wordpress-draft-packages";

export default async function WordPressDraftPackagePage({ params }: { params: Promise<{ id: string }> }) {
  await requireCurrentProfile();
  const { id } = await params;
  const item = await getWordPressDraftPackage(id);
  if (!item) notFound();

  const exportPayload = JSON.stringify({
    status: "draft",
    title: item.title,
    excerpt: item.excerpt,
    content: item.content,
    source_package_id: item.id,
  }, null, 2);

  return (
    <main>
      <h1>{item.title}</h1>
      <p><strong>State:</strong> {item.state}</p>
      <p><strong>Prepared:</strong> {new Date(item.preparedAt).toLocaleString()}</p>
      <h2>Excerpt</h2>
      <p>{item.excerpt ?? "No excerpt supplied."}</p>
      <h2>Content preview</h2>
      <pre>{item.content ?? "No body supplied."}</pre>
      <h2>Manual draft export payload</h2>
      <p>This payload is for reviewed, manual transfer only. It does not call WordPress.</p>
      <pre>{exportPayload}</pre>
    </main>
  );
}
