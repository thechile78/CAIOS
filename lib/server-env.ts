const requiredPublicDatabaseVariables = [
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
] as const;

const requiredServerDatabaseVariables = ["SUPABASE_SERVICE_ROLE_KEY"] as const;

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

export function getPublicDatabaseEnvironment(): PublicDatabaseEnvironment {
  return Object.fromEntries(
    requiredPublicDatabaseVariables.map((name) => [
      name,
      requireEnvironmentVariable(name),
    ]),
  ) as PublicDatabaseEnvironment;
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
  return requiredPublicDatabaseVariables.every(
    (name) => Boolean(process.env[name]?.trim()),
  );
}
