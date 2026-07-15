import { redirect } from "next/navigation";

import { hasDatabaseConfiguration } from "@/lib/server-env";

import { signIn } from "./actions";

const messages: Record<string, string> = {
  not_configured: "Authentication is not configured yet. Add the staging Supabase URL and anon key to the server environment.",
  missing_credentials: "Enter both your email address and password.",
  invalid_credentials: "The email address or password was not accepted.",
  callback_failed: "The sign-in link could not be verified. Please try again.",
};

interface LoginPageProps {
  searchParams: Promise<{ error?: string; next?: string }>;
}

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const params = await searchParams;
  const nextPath =
    params.next?.startsWith("/") && !params.next.startsWith("//")
      ? params.next
      : "/";

  if (params.error === "not_configured" && hasDatabaseConfiguration()) {
    const cleanUrl = nextPath === "/" ? "/login" : `/login?next=${encodeURIComponent(nextPath)}`;
    redirect(cleanUrl);
  }

  const message = params.error ? messages[params.error] : undefined;

  return (
    <main style={{ minHeight: "100vh", display: "grid", placeItems: "center", padding: "2rem" }}>
      <section style={{ width: "min(100%, 28rem)", display: "grid", gap: "1rem" }}>
        <div>
          <p className="eyebrow">CAIOS Secure Access</p>
          <h1>Sign in to the newsroom</h1>
          <p>Use an account created in the non-production Supabase project. New accounts remain read-only until an administrator assigns a newsroom role.</p>
        </div>

        {message ? <p role="alert">{message}</p> : null}

        <form action={signIn} style={{ display: "grid", gap: "1rem" }}>
          <input type="hidden" name="next" value={nextPath} />
          <label>
            Email
            <input name="email" type="email" autoComplete="email" required style={{ width: "100%" }} />
          </label>
          <label>
            Password
            <input name="password" type="password" autoComplete="current-password" required style={{ width: "100%" }} />
          </label>
          <button type="submit">Sign in</button>
        </form>

        <small>No public registration is enabled. Access is granted only through approved newsroom accounts.</small>
      </section>
    </main>
  );
}
