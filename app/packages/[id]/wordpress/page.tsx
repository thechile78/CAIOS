import { notFound } from "next/navigation";

import { requireRole } from "@/lib/auth";
import {
  buildWordPressDraftPayload,
  getWordPressDraftPackage,
  isWordPressDraftOutboxEnabled,
} from "@/lib/wordpress-draft-outbox";

import { queueWordPressDraftIntent } from "./actions";

const draftOutboxRoles = ["administrator", "editor"] as const;

export default async function WordPressDraftPreviewPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string; queued?: string }>;
}) {
  await requireRole(draftOutboxRoles);
  const { id } = await params;
  const query = await searchParams;
  const packageRecord = await getWordPressDraftPackage(id);

  if (!packageRecord) notFound();

  const payload = buildWordPressDraftPayload(packageRecord);
  const enabled = isWordPressDraftOutboxEnabled();
  const canQueue = enabled && !packageRecord.existingOutboxId;

  return (
    <main className="mx-auto max-w-4xl space-y-6 p-6">
      <header>
        <p className="text-sm uppercase tracking-wide text-zinc-500">WordPress draft boundary</p>
        <h1 className="text-3xl font-semibold">{payload.title}</h1>
        <p className="mt-2 text-zinc-600">
          Internal intent only. This page does not contact WordPress.
        </p>
      </header>

      {query.error ? <p className="rounded border border-red-300 bg-red-50 p-3 text-red-800">{query.error}</p> : null}
      {query.queued ? <p className="rounded border border-green-300 bg-green-50 p-3 text-green-800">Draft intent queued: {query.queued}</p> : null}

      <section className="rounded border p-4">
        <h2 className="font-semibold">Safety status</h2>
        <dl className="mt-3 grid gap-2 text-sm">
          <div><dt className="font-medium">Feature flag</dt><dd>{enabled ? "Enabled" : "Disabled"}</dd></div>
          <div><dt className="font-medium">External request</dt><dd>Never made by this milestone</dd></div>
          <div><dt className="font-medium">Allowed WordPress status</dt><dd>draft only</dd></div>
          <div><dt className="font-medium">Existing queued intent</dt><dd>{packageRecord.existingOutboxId ?? "None"}</dd></div>
        </dl>
      </section>

      <section className="rounded border p-4">
        <h2 className="font-semibold">Payload preview</h2>
        <pre className="mt-3 overflow-x-auto whitespace-pre-wrap rounded bg-zinc-100 p-3 text-xs">
          {JSON.stringify(payload, null, 2)}
        </pre>
      </section>

      {canQueue ? (
        <form action={queueWordPressDraftIntent} className="rounded border p-4">
          <input type="hidden" name="packageId" value={packageRecord.id} />
          <input type="hidden" name="expectedCreatedAt" value={packageRecord.createdAt} />
          <p className="text-sm text-zinc-600">
            This creates a database outbox record for later human-controlled delivery. It does not publish, schedule, or call WordPress.
          </p>
          <button className="mt-4 rounded bg-black px-4 py-2 text-white" type="submit">
            Queue internal draft intent
          </button>
        </form>
      ) : (
        <p className="rounded border p-4 text-sm">
          {packageRecord.existingOutboxId
            ? "A draft intent already exists for this package."
            : "The draft outbox is disabled by default."}
        </p>
      )}
    </main>
  );
}
