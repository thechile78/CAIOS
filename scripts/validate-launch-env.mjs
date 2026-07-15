const mode = process.argv[2] ?? "staging";
if (!["staging", "production"].includes(mode)) {
  console.error("Usage: node scripts/validate-launch-env.mjs <staging|production>");
  process.exit(2);
}

const required = [
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
];

const wordpressEnabled = process.env.CAIOS_WORDPRESS_DRAFT_DISPATCH_ENABLED === "true";
if (wordpressEnabled) {
  required.push("CAIOS_WORDPRESS_URL", "CAIOS_WORDPRESS_USERNAME", "CAIOS_WORDPRESS_APPLICATION_PASSWORD");
}

const missing = required.filter((name) => !process.env[name]?.trim());
const violations = [];

if (process.env.CAIOS_WORDPRESS_DRAFT_OUTBOX_ENABLED === "true" && !wordpressEnabled) {
  violations.push("Draft outbox is enabled while dispatch is disabled; this is allowed for review but not a complete launch configuration.");
}

if (mode === "production") {
  if (process.env.CAIOS_WORDPRESS_DRY_RUN !== "false") violations.push("Production requires CAIOS_WORDPRESS_DRY_RUN=false only after staging acceptance.");
  if (process.env.CAIOS_ALLOW_AUTOMATIC_PUBLISH === "true") violations.push("Automatic publishing must remain disabled.");
}

if (missing.length) {
  console.error(`Missing required environment variables: ${missing.join(", ")}`);
  process.exit(1);
}

if (violations.length) {
  for (const violation of violations) console.error(`Launch blocker: ${violation}`);
  process.exit(1);
}

console.log(`${mode} environment passes static launch validation.`);
