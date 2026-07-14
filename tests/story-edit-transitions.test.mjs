import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const migration = await readFile(new URL("../supabase/migrations/20260714050000_v4_6_story_edit_transitions.sql", import.meta.url), "utf8");
const action = await readFile(new URL("../app/stories/[id]/edit/actions.ts", import.meta.url), "utf8");
const input = await readFile(new URL("../lib/story-edit.ts", import.meta.url), "utf8");

test("story updates use optimistic concurrency and authenticated identity", () => {
  assert.match(migration, /auth\.uid\(\)/);
  assert.match(migration, /p_expected_updated_at/);
  assert.match(migration, /story changed by another user/);
  assert.match(migration, /for update/);
});

test("story and audit event are updated in one database function", () => {
  assert.match(migration, /update public\.stories/);
  assert.match(migration, /insert into public\.audit_events/);
  assert.match(migration, /story_updated/);
  assert.match(action, /update_story_with_audit/);
});

test("editing cannot approve publish archive or create WordPress drafts", () => {
  assert.match(migration, /locked story status/);
  assert.doesNotMatch(input, /wordpress_draft|published|approved|archived/);
  assert.doesNotMatch(action, /service.role|SUPABASE_SERVICE_ROLE_KEY/i);
});

test("workflow targets are explicit and bounded", () => {
  assert.match(input, /discovered: \["discovered", "researching"\]/);
  assert.match(input, /asset_review: \["asset_review", "seo_review", "awaiting_approval"\]/);
  assert.match(migration, /invalid workflow transition/);
});
