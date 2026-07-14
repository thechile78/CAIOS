import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const migration = await readFile("supabase/migrations/20260714042000_v4_7_editorial_checklist_approval.sql", "utf8");
const actions = await readFile("app/stories/[id]/review/actions.ts", "utf8");

 test("approval requires an authenticated reviewer and complete checklist", () => {
  assert.match(migration, /auth\.uid\(\)/);
  assert.match(migration, /can_review_newsroom\(\)/);
  assert.match(migration, /editorial checklist is incomplete/);
  assert.match(migration, /status <> 'awaiting_approval'/);
});

test("approval is atomic, audited, and concurrency protected", () => {
  assert.match(migration, /for update/);
  assert.match(migration, /stale story version/);
  assert.match(migration, /insert into public\.approvals/);
  assert.match(migration, /editorial_decision_recorded/);
});

test("review actions do not publish or use a service role", () => {
  assert.doesNotMatch(actions, /service[_-]?role/i);
  assert.doesNotMatch(actions, /wordpress/i);
  assert.doesNotMatch(actions, /publish/i);
  assert.match(actions, /requireRole\(reviewerRoles\)/);
});
