import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const repository = await readFile(
  new URL("../lib/editorial-repository.ts", import.meta.url),
  "utf8",
);
const page = await readFile(new URL("../app/page.tsx", import.meta.url), "utf8");

test("editorial queue uses authenticated Supabase session and RLS", () => {
  assert.match(repository, /createSupabaseServerClient/);
  assert.match(repository, /\.from\("stories"\)/);
  assert.doesNotMatch(repository, /SUPABASE_SERVICE_ROLE_KEY/);
});

test("queue excludes archived stories and caps result size", () => {
  assert.match(repository, /\.neq\("status", "archived"\)/);
  assert.match(repository, /Math\.min\(Math\.max\(Math\.trunc\(limit\), 1\), 100\)/);
});

test("only newsroom editing roles are eligible for future creation", () => {
  assert.match(repository, /administrator/);
  assert.match(repository, /editor/);
  assert.match(repository, /producer/);
  assert.match(repository, /researcher/);
  assert.doesNotMatch(repository, /"reviewer",\s*"read_only"/);
});

test("command center requires an active profile before loading queue", () => {
  assert.match(page, /requireCurrentProfile/);
  assert.match(page, /AuthenticatedEditorialQueue[\s\S]*?role=\{profile\.role\}/);
});
