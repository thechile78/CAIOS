import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const migration = await readFile(
  new URL("../supabase/migrations/20260714182500_v4_9_immutable_package_snapshots.sql", import.meta.url),
  "utf8",
);
const action = await readFile(new URL("../app/handoffs/[id]/package/actions.ts", import.meta.url), "utf8");

test("package rows are immutable through RLS", () => {
  assert.match(migration, /No update or delete policies/);
  assert.doesNotMatch(migration, /for update to authenticated/i);
  assert.doesNotMatch(migration, /for delete to authenticated/i);
});

test("packaging validates role, concurrency, approval, and checklist", () => {
  assert.match(migration, /current_app_role\(\) not in \('administrator', 'editor', 'producer'\)/);
  assert.match(migration, /stale handoff version/);
  assert.match(migration, /v_story\.status <> 'approved'/);
  assert.match(migration, /v_checklist\.human_approved/);
  assert.match(migration, /matching approval record is missing/);
});

test("package creation is atomic and audited", () => {
  assert.match(migration, /insert into public\.editorial_packages/);
  assert.match(migration, /set state = 'packaged'/);
  assert.match(migration, /editorial_package_created/);
});

test("server action uses authenticated role and snapshots story sources", () => {
  assert.match(action, /requireRole\(packagingRoles\)/);
  assert.match(action, /\.from\("sources"\)/);
  assert.match(action, /\.eq\("story_id", handoff\.story_id\)/);
  assert.doesNotMatch(action, /service[_-]?role/i);
  assert.doesNotMatch(action, /wordpress/i);
});
