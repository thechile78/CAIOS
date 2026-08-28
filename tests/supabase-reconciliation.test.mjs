import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const migrationPath = new URL(
  "../supabase/migrations/20260828003702_reconcile_supabase_advisors.sql",
  import.meta.url,
);
const reportPath = new URL(
  "../docs/operations/supabase-migration-reconciliation.md",
  import.meta.url,
);

const migration = await readFile(migrationPath, "utf8");
const report = await readFile(reportPath, "utf8");

test("advisor reconciliation fixes the mutable trigger search path", () => {
  assert.match(
    migration,
    /alter function public\.set_updated_at_timestamp\(\)\s+set search_path = '';/,
  );
});

test("advisor reconciliation covers the Search Console actor foreign key", () => {
  assert.match(
    migration,
    /create index if not exists search_console_connections_connected_by_idx\s+on public\.search_console_connections \(connected_by\);/,
  );
});

test("reconciliation remains forward-only and preserves intentional deny-all tables", () => {
  assert.match(report, /forward-only reconciliation/i);
  assert.match(report, /RLS enabled with no policies/);
  assert.match(report, /deny-by-default/);
  assert.match(report, /Do not\s+repair or rewrite remote migration history/);
});
