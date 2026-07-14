import Link from "next/link";

import { requireCurrentProfile } from "@/lib/auth";
import { listWordPressDraftPackages } from "@/lib/wordpress-draft-packages";

export default async function WordPressDraftPackagesPage() {
  await requireCurrentProfile();
  const packages = await listWordPressDraftPackages();

  return (
    <main>
      <h1>WordPress Draft Packages</h1>
      <p>Internal, immutable content snapshots. Nothing on this page is sent to WordPress.</p>
      {packages.length === 0 ? (
        <p>No draft packages have been prepared.</p>
      ) : (
        <ul>
          {packages.map((item) => (
            <li key={item.id}>
              <Link href={`/wordpress-drafts/${item.id}`}>{item.title}</Link>{" "}
              <span>({item.state})</span>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
