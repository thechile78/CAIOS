const requiredPublicDatabaseVariables = [
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
] as const;

const requiredServerDatabaseVariables = ["SUPABASE_SERVICE_ROLE_KEY"] as const;

const canonicalSupabaseProjectRef = "ozucetngucaerxjziily";
const canonicalSupabaseOrigin = `https://${canonicalSupabaseProjectRef}.supabase.co`;

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

export function getPublicDatabaseEnvironment(): PublicDatabaseEnvironment {
  const environment = Object.fromEntries(
    requiredPublicDatabaseVariables.map((name) => [
      name,
      requireEnvironmentVariable(name),
    ]),
  ) as PublicDatabaseEnvironment;

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
  if (
    !requiredPublicDatabaseVariables.every(
      (name) => Boolean(process.env[name]?.trim()),
    )
  ) {
    return false;
  }

  try {
    assertCanonicalSupabaseBinding(process.env.NEXT_PUBLIC_SUPABASE_URL!.trim());
    return true;
  } catch {
    return false;
  }
}
