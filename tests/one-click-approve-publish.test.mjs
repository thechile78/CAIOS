import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const action = await readFile("app/stories/[id]/approval-actions.ts", "utf8");
const page = await readFile("app/stories/[id]/page.tsx", "utf8");
const publication = await readFile("lib/wordpress-publication.ts", "utf8");
const migration = await readFile(
  "supabase/migrations/20260729003000_one_click_approve_publish.sql",
  "utf8",
);

test("one reviewer click records approval before contacting WordPress", () => {
  const approvalIndex = action.indexOf("begin_approved_wordpress_publication");
  const publishIndex = action.indexOf("publishWordPressPost(payload)");
  const finishIndex = action.indexOf("finish_approved_wordpress_publication");
  assert.ok(approvalIndex >= 0);
  assert.ok(publishIndex > approvalIndex);
  assert.ok(finishIndex > publishIndex);
  assert.match(page, /Approve &amp; Publish/);
});

test("WordPress receives only a publish payload assembled from the approved story", () => {
  assert.match(publication, /story\.status !== "approved"/);
  assert.match(publication, /status: "publish"/);
  assert.match(publication, /buildWordPressContent/);
});

test("database marks published only after WordPress success and audits failure", () => {
  assert.match(migration, /case when p_success then 'wordpress_publication_succeeded' else 'wordpress_publication_failed'/);
  const successBranch = migration.match(/if p_success then([\s\S]*?)else/)?.[1] ?? "";
  assert.match(successBranch, /set status = 'published'/);
  const failureBranch = migration.match(/else([\s\S]*?)end if;/)?.[1] ?? "";
  assert.doesNotMatch(failureBranch, /set status = 'published'/);
  assert.match(migration, /stale story version/);
  assert.match(migration, /editorial checklist is incomplete/);
});
