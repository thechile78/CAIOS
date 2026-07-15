import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const client = await readFile(new URL("../lib/wordpress-client.ts", import.meta.url), "utf8");
const migration = await readFile(new URL("../supabase/migrations/20260715022500_v5_1_wordpress_draft_dispatch.sql", import.meta.url), "utf8");
const action = await readFile(new URL("../app/outbox/[id]/dispatch/actions.ts", import.meta.url), "utf8");

test("dispatch is disabled and dry-run by default", () => {
  assert.match(client, /DRAFT_DISPATCH_ENABLED/);
  assert.match(client, /DRAFT_DRY_RUN !== "false"/);
});

test("transport enforces HTTPS, draft status, timeout, and redirect rejection", () => {
  assert.match(client, /protocol !== "https:"/);
  assert.match(client, /record\.status !== "draft"/);
  assert.match(client, /10_000/);
  assert.match(client, /redirect: "error"/);
});

test("database uses role checks, stale-write protection, lease, and audit events", () => {
  assert.match(migration, /administrator.*editor/);
  assert.match(migration, /stale outbox version/);
  assert.match(migration, /lease_expires_at/);
  assert.match(migration, /wordpress_draft_dispatch_succeeded/);
  assert.match(migration, /wordpress_draft_dispatch_failed/);
});

test("manual action never requests publish or schedule", () => {
  assert.doesNotMatch(action, /status:\s*["']publish["']/);
  assert.doesNotMatch(action, /date_gmt/);
  assert.match(action, /requireRole/);
});