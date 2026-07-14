import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const migration = await readFile(
  new URL("../supabase/migrations/20260714043000_v4_8_approval_queue_handoff.sql", import.meta.url),
  "utf8",
);
const action = await readFile(
  new URL("../app/approval-queue/actions.ts", import.meta.url),
  "utf8",
);
const repository = await readFile(
  new URL("../lib/approval-handoff.ts", import.meta.url),
  "utf8",
);

test("handoff requires an approved story and completed human-approved checklist", () => {
  assert.match(migration, /v_story\.status <> 'approved'/);
  assert.match(migration, /v_checklist\.human_approved/);
  assert.match(migration, /matching approval record is missing/);
});

test("handoff actor identity comes from the authenticated session", () => {
  assert.match(migration, /v_actor uuid := auth\.uid\(\)/);
  assert.match(migration, /requested_by, updated_by/);
});

test("duplicate active handoffs are blocked", () => {
  assert.match(migration, /one_active_handoff_per_story/);
  assert.match(migration, /ready_for_packaging/);
});

test("handoff creation and audit event occur in one database function", () => {
  assert.match(migration, /insert into public\.editorial_handoffs/);
  assert.match(migration, /approved_story_handoff_requested/);
});

test("browser action uses the authenticated RPC and no service role", () => {
  assert.match(action, /request_approved_story_handoff/);
  assert.doesNotMatch(action, /service_role|SUPABASE_SERVICE_ROLE_KEY/i);
  assert.doesNotMatch(repository, /service_role|SUPABASE_SERVICE_ROLE_KEY/i);
});

test("milestone does not connect to WordPress or publish", () => {
  assert.doesNotMatch(migration, /wp-json|wordpress.*fetch|publish_post/i);
  assert.doesNotMatch(action, /wp-json|wordpress.*fetch|publish_post/i);
});
