import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const migration = await readFile(
  new URL("../supabase/migrations/20260714183500_v5_0_wordpress_draft_outbox.sql", import.meta.url),
  "utf8",
);
const action = await readFile(
  new URL("../app/packages/[id]/wordpress/actions.ts", import.meta.url),
  "utf8",
);
const repository = await readFile(
  new URL("../lib/wordpress-draft-outbox.ts", import.meta.url),
  "utf8",
);

test("WordPress outbox permits draft intent only", () => {
  assert.match(migration, /payload ->> 'status' = 'draft'/);
  assert.match(migration, /only WordPress draft intent is allowed/);
  assert.doesNotMatch(migration, /status'\s*,\s*'publish'/);
});

test("scheduling and sensitive overrides are rejected", () => {
  assert.match(migration, /date_gmt/);
  assert.match(migration, /scheduling fields are prohibited/);
  assert.match(migration, /credential and author override fields are prohibited/);
});

test("outbox is disabled by default and makes no network call", () => {
  assert.match(repository, /CAIOS_WORDPRESS_DRAFT_OUTBOX_ENABLED === "true"/);
  assert.match(action, /WordPress%20draft%20outbox%20is%20disabled/);
  assert.doesNotMatch(action, /fetch\s*\(/);
  assert.doesNotMatch(action, /axios/);
});

test("database enforces role, approval snapshot, idempotency, and audit", () => {
  assert.match(migration, /administrator', 'editor/);
  assert.match(migration, /story_snapshot ->> 'status' <> 'approved'/);
  assert.match(migration, /human_approved/);
  assert.match(migration, /package already has a queued WordPress draft intent/);
  assert.match(migration, /external_request_made', false/);
});
