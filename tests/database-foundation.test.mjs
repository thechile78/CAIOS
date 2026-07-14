import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const migrationPath = new URL(
  "../supabase/migrations/20260714025200_database_auth_foundation.sql",
  import.meta.url,
);
const environmentPath = new URL("../lib/server-env.ts", import.meta.url);

const migration = await readFile(migrationPath, "utf8");
const environment = await readFile(environmentPath, "utf8");

test("all foundational newsroom tables enable row-level security", () => {
  const tables = [
    "profiles",
    "stories",
    "story_sources",
    "editorial_checklists",
    "approvals",
    "audit_events",
    "publication_records",
  ];

  for (const table of tables) {
    assert.match(
      migration,
      new RegExp(`alter table public\\.${table} enable row level security;`),
    );
  }
});

test("approval and audit records remain append-only for ordinary roles", () => {
  assert.match(migration, /reviewers append approvals/);
  assert.match(migration, /authenticated users append own audit events/);
  assert.doesNotMatch(migration, /approvals for update/i);
  assert.doesNotMatch(migration, /approvals for delete/i);
  assert.doesNotMatch(migration, /audit_events for update/i);
  assert.doesNotMatch(migration, /audit_events for delete/i);
});

test("publication requests require completed editorial and human checks", () => {
  for (const field of [
    "sources_verified",
    "facts_verified",
    "rights_reviewed",
    "seo_reviewed",
    "human_approved",
  ]) {
    assert.match(migration, new RegExp(`c\\.${field}`));
  }

  assert.match(migration, /approved_by is not null/);
});

test("service-role credential stays behind a server-only boundary", () => {
  assert.match(environment, /SUPABASE_SERVICE_ROLE_KEY/);
  assert.doesNotMatch(environment, /NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY/);
  assert.match(environment, /Never import or call this function from a Client Component/);
});
