import Link from "next/link";

import { requireRole } from "@/lib/auth";
import { getMetaConnectionSummary } from "@/lib/social-token-vault";

export const dynamic = "force-dynamic";

interface MetaIntegrationPageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

function readParam(value: string | string[] | undefined): string | null {
  return typeof value === "string" ? value : null;
}

export default async function MetaIntegrationPage({ searchParams }: MetaIntegrationPageProps) {
  await requireRole(["administrator"]);
  const params = await searchParams;
  const error = readParam(params.error);
  const connections = await getMetaConnectionSummary().catch(() => []);
  const facebook = connections.find((connection) => connection.provider === "facebook");
  const instagram = connections.find((connection) => connection.provider === "instagram");
  const correctlyLinked =
    connections.length === 2 &&
    facebook?.providerAccountId === "1214069685123391" &&
    facebook.accountName === "Chilemaniacs" &&
    instagram?.providerAccountId === "17841403279084160" &&
    String(instagram.metadata.account_type).toUpperCase() === "BUSINESS" &&
    connections.every(
      (connection) =>
        connection.publishingEnabled === false &&
        connection.schedulingEnabled === false &&
        connection.autoPostEnabled === false &&
        connection.autoApprovalEnabled === false &&
        connection.approvalRequired === true,
    );

  return (
    <main className="shell">
      <section className="content">
        <header className="hero">
          <p className="eyebrow">CAIOS Social Hub</p>
          <h1>Facebook and Instagram connection</h1>
          <p>Read-only identity linking for the Chilemaniacs Page and its Instagram Business account.</p>
        </header>

        <section className="panel">
          <div className="panel-heading">
            <div>
              <p className="eyebrow">Verified account target</p>
              <h2>{correctlyLinked ? "Meta accounts connected" : "Connect the approved Meta accounts"}</h2>
            </div>
            <span className="safety-badge">Approval required</span>
          </div>

          {error ? <p role="alert"><strong>Connection error:</strong> {error}</p> : null}
          <p><strong>Facebook Page:</strong> {correctlyLinked ? facebook?.accountName : "Chilemaniacs"} — {correctlyLinked ? facebook?.providerAccountId : "1214069685123391"}</p>
          <p><strong>Instagram Business:</strong> {correctlyLinked ? instagram?.accountName : "@thechilepromotions"} — {correctlyLinked ? instagram?.providerAccountId : "17841403279084160"}</p>
          <p><strong>Status:</strong> {correctlyLinked ? "Verified through the Meta Graph API" : "Not yet verified and stored in CAIOS"}</p>
          {correctlyLinked ? <p><strong>Granted scopes:</strong> {facebook?.scopes.join(", ")}</p> : null}

          <h3>Enforced safeguards</h3>
          <ul>
            <li>Publishing: disabled</li>
            <li>Scheduling: disabled</li>
            <li>Automatic posting: disabled</li>
            <li>Automatic approval: disabled</li>
            <li>Explicit user approval before every post: required</li>
            <li>Publishing permissions: not requested</li>
          </ul>
          <p>This connection only verifies and stores account access. It does not create, publish, schedule, queue, or approve content.</p>
          <a className="primary-button" href="/api/integrations/meta/connect">
            {correctlyLinked ? "Reverify Meta accounts" : "Connect Meta securely"}
          </a>
          <p><Link href="/">Return to the command center</Link></p>
        </section>
      </section>
    </main>
  );
}
