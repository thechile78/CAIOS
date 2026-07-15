import { notFound } from "next/navigation";

import { requireRole } from "@/lib/auth";
import { getWordPressDispatchRecord } from "@/lib/wordpress-dispatch";
import { isWordPressDispatchEnabled, isWordPressDryRun } from "@/lib/wordpress-client";

import { dispatchWordPressDraft } from "./actions";

const dispatchRoles = ["administrator", "editor"] as const;

export default async function WordPressDispatchPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string; sent?: string }>;
}) {
  await requireRole(dispatchRoles);
  const { id } = await params;
  const query = await searchParams;
  const record = await getWordPressDispatchRecord(id);
  if (!record) notFound();

  const enabled = isWordPressDispatchEnabled();
  const dryRun = isWordPressDryRun();
  const canDispatch = enabled && ["queued", "failed"].includes(record.state);

  return (
    <main className="mx-auto max-w-4xl space-y-6 p-6">
      <header>
        <p className="text-sm uppercase tracking-wide text-zinc-500">WordPress draft dispatch</p>
        <h1 className="text-3xl font-semibold">Manual staging dispatch</h1>
        <p className="mt-2 text-zinc-600">State: {record.state} · Attempts: {record.attemptCount}</p>
      </header>

      {query.error ? <p className="rounded border border-red-300 bg-red-50 p-3 text-red-800">{query.error}</p> : null}
      {query.sent ? <p className="rounded border border-green-300 bg-green-50 p-3 text-green-800">Dispatch completed: {query.sent}</p> : null}

      <section className="rounded border p-4 text-sm">
        <p>Dispatch enabled: {enabled ? "yes" : "no"}</p>
        <p>Dry-run mode: {dryRun ? "yes" : "no"}</p>
        <p>External post ID: {record.externalPostId ?? "None"}</p>
        <p>Last error: {record.lastError ?? "None"}</p>
      </section>

      <section className="rounded border p-4">
        <h2 className="font-semibold">Draft payload</h2>
        <pre className="mt-3 overflow-auto whitespace-pre-wrap text-xs">{JSON.stringify(record.payload, null, 2)}</pre>
      </section>

      {canDispatch ? (
        <form action={dispatchWordPressDraft} className="rounded border p-4">
          <input type="hidden" name="outboxId" value={record.id} />
          <input type="hidden" name="expectedUpdatedAt" value={record.updatedAt} />
          <p className="text-sm text-zinc-600">This action can only create a WordPress draft. Publishing and scheduling remain prohibited.</p>
          <button type="submit" className="mt-4 rounded bg-black px-4 py-2 text-white">Dispatch draft manually</button>
        </form>
      ) : (
        <p className="rounded border p-4 text-sm">Dispatch is disabled or this outbox record is not eligible.</p>
      )}
    </main>
  );
}