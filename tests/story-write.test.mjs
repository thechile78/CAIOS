import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const migration = await readFile(new URL("../supabase/migrations/20260714040000_validated_story_writes.sql", import.meta.url), "utf8");
const action = await readFile(new URL("../app/stories/new/actions.ts", import.meta.url), "utf8");
const page = await readFile(new URL("../app/stories/new/page.tsx", import.meta.url), "utf8");

test("story creation derives actor identity and begins in discovery", () => {
  assert.match(migration, /actor uuid := auth\.uid\(\)/);
  assert.match(migration, /'discovered'/);
  assert.doesNotMatch(action, /created_by|updated_by|owner_id/);
});

test("story and audit event are written inside one database function", () => {
  assert.match(migration, /insert into public\.stories/);
  assert.match(migration, /insert into public\.audit_events/);
  assert.match(migration, /'story\.created'/);
});

test("write path remains role gated and has no publishing capability", () => {
  assert.match(action, /requireRole\(creatorRoles\)/);
  assert.match(action, /create_story_with_audit/);
  assert.match(page, /cannot approve, publish, schedule, or create a WordPress draft/i);
  for (const source of [action, migration]) {
    assert.doesNotMatch(source, /SUPABASE_SERVICE_ROLE_KEY/);
    assert.doesNotMatch(source, /wordpress_draft|published|schedule/i);
  }
});
