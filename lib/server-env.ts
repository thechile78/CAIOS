const requiredPublicDatabaseVariables = [
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
] as const;

const requiredServerDatabaseVariables = ["SUPABASE_SERVICE_ROLE_KEY"] as const;

const canonicalSupabaseProjectRef = "ozucetngucaerxjziily";
const canonicalSupabaseOrigin = `https://${canonicalSupabaseProjectRef}.supabase.co`;
const canonicalSupabasePublishableKey =
  "sb_publishable_5smX6aQLk6pBGOcL0SzV4Q_yVM8SIEd";

type PublicDatabaseEnvironment = Record<
  (typeof requiredPublicDatabaseVariables)[number],
  string
>;

type ServerDatabaseEnvironment = PublicDatabaseEnvironment &
  Record<(typeof requiredServerDatabaseVariables)[number], string>;

function requireEnvironmentVariable(name: string): string {
  const value = process.env[name]?.trim();

  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }

  return value;
}

function assertCanonicalSupabaseBinding(urlValue: string): void {
  let origin: string;

  try {
    origin = new URL(urlValue).origin;
  } catch {
    throw new Error("NEXT_PUBLIC_SUPABASE_URL must be a valid HTTPS URL");
  }

  if (origin !== canonicalSupabaseOrigin) {
    throw new Error(
      `Unsafe Supabase project binding. Expected ${canonicalSupabaseOrigin}, received ${origin}.`,
    );
  }
}

/**
 * CAIOS uses one fixed non-production Supabase project. Public browser
 * credentials are intentionally project-locked here so stale hosting values
 * cannot silently redirect authentication to another project.
 */
export function getPublicDatabaseEnvironment(): PublicDatabaseEnvironment {
  const environment: PublicDatabaseEnvironment = {
    NEXT_PUBLIC_SUPABASE_URL: canonicalSupabaseOrigin,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: canonicalSupabasePublishableKey,
  };

  assertCanonicalSupabaseBinding(environment.NEXT_PUBLIC_SUPABASE_URL);
  return environment;
}

/**
 * Server-only boundary for privileged database operations.
 * Never import or call this function from a Client Component.
 */
export function getServerDatabaseEnvironment(): ServerDatabaseEnvironment {
  return {
    ...getPublicDatabaseEnvironment(),
    SUPABASE_SERVICE_ROLE_KEY: requireEnvironmentVariable(
      "SUPABASE_SERVICE_ROLE_KEY",
    ),
  };
}

export function hasDatabaseConfiguration(): boolean {
  try {
    getPublicDatabaseEnvironment();
    return true;
  } catch {
    return false;
  }
}
