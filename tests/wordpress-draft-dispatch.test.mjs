import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const client = await readFile(new URL("../lib/wordpress-client.ts", import.meta.url), "utf8");
const migration = await readFile(new URL("../supabase/migrations/20260715022500_v5_1_wordpress_draft_dispatch.sql", import.meta.url), "utf8");
const rpcBoundaryMigration = await readFile(
  new URL("../supabase/migrations/20260728003904_fix_wordpress_pipeline_rpc_boundary.sql", import.meta.url),
  "utf8",
);
const action = await readFile(new URL("../app/outbox/[id]/dispatch/actions.ts", import.meta.url), "utf8");

test("dispatch is disabled and dry-run by default", () => {
  assert.match(client, /DRAFT_DISPATCH_ENABLED/);
  assert.match(client, /DRAFT_DRY_RUN !== "false"/);
});

test("transport uses WordPress.com OAuth and enforces the requested bounded status", () => {
  assert.match(client, /public-api\.wordpress\.com\/rest\/v1\.1/);
  assert.match(client, /CAIOS_WORDPRESS_OAUTH_ACCESS_TOKEN/);
  assert.match(client, /authorization: `Bearer \$\{accessToken\}`/);
  assert.match(client, /record\.status !== expectedStatus/);
  assert.match(client, /new URLSearchParams\(\)/);
  assert.match(client, /body\.set\("status", expectedStatus\)/);
  assert.match(client, /body\.set\("publicize", "false"\)/);
  assert.match(client, /application\/x-www-form-urlencoded/);
  assert.doesNotMatch(client, /content-type": "application\/json"/);
  assert.match(client, /posts\/new\//);
  assert.match(client, /getWordPressError/);
  assert.match(client, /slice\(0, 300\)/);
  assert.match(client, /responseBody\.status !== expectedStatus/);
  assert.match(client, /sendWordPressPost\(payload, "draft"\)/);
  assert.match(client, /sendWordPressPost\(payload, "publish"\)/);
  assert.match(client, /10_000/);
  assert.match(client, /redirect: "error"/);
  assert.doesNotMatch(client, /Basic \$\{/);
  assert.doesNotMatch(client, /APPLICATION_PASSWORD/);
});

test("database uses role checks, stale-write protection, lease, and audit events", () => {
  assert.match(migration, /administrator.*editor/);
  assert.match(migration, /stale outbox version/);
  assert.match(migration, /lease_expires_at/);
  assert.match(migration, /wordpress_draft_dispatch_succeeded/);
  assert.match(migration, /wordpress_draft_dispatch_failed/);
});

test("validated pipeline RPCs cross RLS without exposing table writes", () => {
  assert.match(rpcBoundaryMigration, /package_approved_handoff.*security definer/);
  assert.match(rpcBoundaryMigration, /queue_wordpress_draft_intent.*security definer/);
  assert.match(rpcBoundaryMigration, /begin_wordpress_draft_dispatch.*security definer/);
  assert.match(rpcBoundaryMigration, /finish_wordpress_draft_dispatch.*security definer/);
  assert.match(rpcBoundaryMigration, /revoke execute[\s\S]*from public, anon/);
  assert.match(rpcBoundaryMigration, /grant execute[\s\S]*to authenticated/);
});

test("manual action never requests publish or schedule", () => {
  assert.doesNotMatch(action, /status:\s*["']publish["']/);
  assert.doesNotMatch(action, /date_gmt/);
  assert.match(action, /requireRole/);
});
