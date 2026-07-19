import Link from "next/link";

export const dynamic = "force-dynamic";

interface YouTubeIntegrationPageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

function readParam(value: string | string[] | undefined): string | null {
  return typeof value === "string" ? value : null;
}

export default async function YouTubeIntegrationPage({ searchParams }: YouTubeIntegrationPageProps) {
  const params = await searchParams;
  const connected = readParam(params.connected) === "1";
  const channel = readParam(params.channel);
  const channelId = readParam(params.channelId);
  const refreshToken = readParam(params.refreshToken);
  const error = readParam(params.error);

  return (
    <main className="shell">
      <section className="content">
        <header className="hero">
          <p className="eyebrow">CAIOS Social Hub</p>
          <h1>YouTube connection</h1>
          <p>This setup page performs a limited OAuth acceptance test using channel identification and video-upload permission only.</p>
        </header>

        <section className="panel">
          <div className="panel-heading">
            <div>
              <p className="eyebrow">Approval-first integration</p>
              <h2>{connected ? "YouTube authorization test passed" : "Connect The Chile YouTube channel"}</h2>
            </div>
            <span className="safety-badge">No automatic publishing</span>
          </div>

          {connected ? (
            <div>
              <p><strong>Channel:</strong> {channel}</p>
              <p><strong>Channel ID:</strong> {channelId}</p>
              <p><strong>Offline token:</strong> {refreshToken}</p>
              <p>The OAuth flow and channel verification work. Tokens are not persisted during this acceptance phase, and no upload or publication was performed.</p>
            </div>
          ) : null}

          {error ? <p role="alert"><strong>Connection error:</strong> {error}</p> : null}

          <p>CAIOS will eventually prepare private uploads and metadata drafts. Your explicit approval remains required before any upload test or public release.</p>
          <a className="primary-button" href="/api/integrations/youtube/connect">Connect YouTube securely</a>
          <p><Link href="/login">Newsroom sign in</Link></p>
        </section>
      </section>
    </main>
  );
}