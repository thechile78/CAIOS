import Link from "next/link";

import { requireRole } from "@/lib/auth";
import { getWordPressConnectionSummary } from "@/lib/social-token-vault";
import { WORDPRESS_REQUIRED_SCOPES } from "@/lib/wordpress-oauth";

export const dynamic = "force-dynamic";

interface WordPressIntegrationPageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

function readParam(value: string | string[] | undefined): string | null {
  return typeof value === "string" ? value : null;
}

export default async function WordPressIntegrationPage({
  searchParams,
}: WordPressIntegrationPageProps) {
  await requireRole(["administrator"]);
  const params = await searchParams;
  const error = readParam(params.error);
  const connection = await getWordPressConnectionSummary().catch(() => null);
  const connected =
    connection !== null &&
    WORDPRESS_REQUIRED_SCOPES.every((scope) => connection.scopes.includes(scope));

  return (
    <main className="shell">
      <section className="content">
        <header className="hero">
          <p className="eyebrow">CAIOS WordPress Connection</p>
          <h1>{connected ? "WordPress is ready" : "Reconnect WordPress"}</h1>
          <p>
            Secure authorization for human-approved Chilemaniacs articles and
            their rights-cleared featured images.
          </p>
        </header>
        <section className="panel">
          {error ? (
            <p className="editorial-notice editorial-notice-error" role="alert">
              <strong>Connection error:</strong> {error}
            </p>
          ) : null}
          {readParam(params.connected) ? (
            <p className="editorial-notice editorial-notice-success" role="status">
              WordPress connected with posts and media access.
            </p>
          ) : null}
          <p><strong>Status:</strong> {connected ? "Connected" : "Action required"}</p>
          <p><strong>Site:</strong> {connection?.blogUrl ?? "Chilemaniacs"}</p>
          <p>
            <strong>Required permissions:</strong>{" "}
            {WORDPRESS_REQUIRED_SCOPES.join(", ")}
          </p>
          <p>
            This connection cannot approve content by itself. A reviewer must
            still use Approve &amp; Publish or Retry WordPress publication for
            each article.
          </p>
          <a className="primary-button" href="/api/integrations/wordpress/connect">
            {connected ? "Reconnect WordPress" : "Connect WordPress securely"}
          </a>
          <p><Link href="/">Return to the command center</Link></p>
        </section>
      </section>
    </main>
  );
}
