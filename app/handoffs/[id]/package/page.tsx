import { notFound } from "next/navigation";

import { requireRole } from "@/lib/auth";
import { getPackageHandoff } from "@/lib/editorial-packages";

import { createInternalPackage } from "./actions";

const packagingRoles = ["administrator", "editor", "producer"] as const;

export default async function PackageHandoffPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string; packaged?: string }>;
}) {
  await requireRole(packagingRoles);
  const { id } = await params;
  const query = await searchParams;
  const handoff = await getPackageHandoff(id);

  if (!handoff) notFound();

  const canPackage = !handoff.packageId && ["ready_for_packaging", "packaging"].includes(handoff.state);

  return (
    <main className="mx-auto max-w-4xl space-y-6 p-6">
      <header>
        <p className="text-sm uppercase tracking-wide text-zinc-500">Internal package</p>
        <h1 className="text-3xl font-semibold">{handoff.story.title}</h1>
        <p className="mt-2 text-zinc-600">{handoff.story.desk} · {handoff.story.priority} · {handoff.state}</p>
      </header>

      {query.error ? <p className="rounded border border-red-300 bg-red-50 p-3 text-red-800">{query.error}</p> : null}
      {query.packaged ? <p className="rounded border border-green-300 bg-green-50 p-3 text-green-800">Immutable package created: {query.packaged}</p> : null}

      <section className="rounded border p-4">
        <h2 className="font-semibold">Approved story snapshot preview</h2>
        <p className="mt-3 whitespace-pre-wrap text-sm">{handoff.story.summary ?? "No summary provided."}</p>
        <p className="mt-3 whitespace-pre-wrap text-sm">{handoff.story.body ?? "No body provided."}</p>
      </section>

      <section className="rounded border p-4">
        <h2 className="font-semibold">Approval metadata</h2>
        <p className="mt-2 text-sm">Approved by: {handoff.story.approvedBy ?? "Unavailable"}</p>
        <p className="text-sm">Approved at: {handoff.story.approvedAt ?? "Unavailable"}</p>
        <p className="text-sm">Existing package: {handoff.packageId ?? "None"}</p>
      </section>

      {canPackage ? (
        <form action={createInternalPackage} className="rounded border p-4">
          <input type="hidden" name="handoffId" value={handoff.id} />
          <input type="hidden" name="expectedUpdatedAt" value={handoff.updatedAt} />
          <p className="text-sm text-zinc-600">This creates an immutable internal snapshot. It does not contact WordPress or publish anything.</p>
          <button className="mt-4 rounded bg-black px-4 py-2 text-white" type="submit">Create immutable package</button>
        </form>
      ) : (
        <p className="rounded border p-4 text-sm">This handoff cannot be packaged again.</p>
      )}
    </main>
  );
}
