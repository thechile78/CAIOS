import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const migration = await readFile("supabase/migrations/20260714182500_v4_9_wordpress_draft_packages.sql", "utf8");
const action = await readFile("app/wordpress-drafts/actions.ts", "utf8");
const preview = await readFile("app/wordpress-drafts/[id]/page.tsx", "utf8");

test("draft package requires approved editorial state", () => {
  assert.match(migration, /v_story\.status <> 'approved'/);
  assert.match(migration, /human_approved/);
  assert.match(migration, /matching approval record is missing/);
});

test("draft package creation is role gated and concurrency protected", () => {
  assert.match(migration, /administrator', 'editor', 'producer/);
  assert.match(migration, /stale story version/);
  assert.match(action, /requireRole\(packagingRoles\)/);
});

test("duplicate active packages are blocked", () => {
  assert.match(migration, /one_active_wordpress_package_per_story/);
});

test("milestone does not connect to or publish through WordPress", () => {
  assert.doesNotMatch(action, /fetch\(|axios|wp-json|publish/i);
  assert.match(preview, /does not call WordPress/);
  assert.match(preview, /status: "draft"/);
});
