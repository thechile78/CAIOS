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
  const stored = readParam(params.stored) === "1";
  const channel = readParam(params.channel);
  const channelId = readParam(params.channelId);
  const error = readParam(params.error);

  return (
    <main className="shell">
      <section className="content">
        <header className="hero">
          <p className="eyebrow">CAIOS Social Hub</p>
          <h1>YouTube connection</h1>
          <p>Connect The Chile channel through Google OAuth using only channel-identification and video-upload permissions.</p>
        </header>

        <section className="panel">
          <div className="panel-heading">
            <div>
              <p className="eyebrow">Approval-first integration</p>
              <h2>{connected ? "YouTube connected securely" : "Connect The Chile YouTube channel"}</h2>
            </div>
            <span className="safety-badge">No automatic publishing</span>
          </div>

          {connected ? (
            <div>
              <p><strong>Channel:</strong> {channel}</p>
              <p><strong>Channel ID:</strong> {channelId}</p>
              <p><strong>Encrypted token vault:</strong> {stored ? "Saved" : "Not saved"}</p>
              <p>The connection is ready for an approval-gated private upload test. No upload or publication was performed during authorization.</p>
            </div>
          ) : null}

          {error ? <p role="alert"><strong>Connection error:</strong> {error}</p> : null}

          <p>CAIOS may prepare private uploads and metadata drafts, but your explicit approval remains required before every upload test or public release.</p>
          <a className="primary-button" href="/api/integrations/youtube/connect">Connect YouTube securely</a>
          <p><Link href="/login">Newsroom sign in</Link></p>
        </section>
      </section>
    </main>
  );
}
