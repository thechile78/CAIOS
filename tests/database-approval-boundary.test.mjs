import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const migrationPath = new URL(
  "../supabase/migrations/20260714030000_harden_approval_boundary.sql",
  import.meta.url,
);

const migration = await readFile(migrationPath, "utf8");

test("approved story states require a completed checklist and authorized approval", () => {
  assert.match(migration, /enforce_story_approval_boundary_trigger/);
  assert.match(migration, /c\.sources_verified/);
  assert.match(migration, /c\.facts_verified/);
  assert.match(migration, /c\.rights_reviewed/);
  assert.match(migration, /c\.seo_reviewed/);
  assert.match(migration, /c\.human_approved/);
  assert.match(migration, /a\.decision = 'approved'/);
  assert.match(migration, /p\.role in \('administrator', 'editor', 'reviewer'\)/);
});

test("publication requests must match the story's recorded approver", () => {
  assert.match(migration, /enforce_publication_request_boundary_trigger/);
  assert.match(migration, /s\.approved_by = new\.approved_by/);
});

test("editorial checklists cannot be deleted by ordinary newsroom roles", () => {
  assert.match(migration, /for insert to authenticated/);
  assert.match(migration, /for update to authenticated/);
  assert.doesNotMatch(migration, /editorial_checklists for delete/i);
  assert.doesNotMatch(migration, /editorial_checklists for all/i);
});
