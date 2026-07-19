import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("social drafts are hard-bound to the approved Meta accounts and safe states", async () => {
  const migration = await read("supabase/migrations/20260719120500_social_draft_approval_workflow.sql");
  assert.match(migration, /1214069685123391/);
  assert.match(migration, /17841403279084160/);
  assert.match(migration, /status in \('draft', 'ready_for_review', 'changes_requested', 'approved', 'rejected'\)/);
  assert.doesNotMatch(migration.match(/status in \([^)]+\)/)?.[0] ?? "", /scheduled|publishing|published/);
  assert.match(migration, /publishing_enabled boolean not null default false check \(publishing_enabled = false\)/);
  assert.match(migration, /scheduling_enabled boolean not null default false check \(scheduling_enabled = false\)/);
  assert.match(migration, /auto_post_enabled boolean not null default false check \(auto_post_enabled = false\)/);
  assert.match(migration, /auto_approval_enabled boolean not null default false check \(auto_approval_enabled = false\)/);
  assert.match(migration, /approval_required boolean not null default true check \(approval_required = true\)/);
});

test("social approval is explicit, role-gated, hash-bound, and audited", async () => {
  const migration = await read("supabase/migrations/20260719120500_social_draft_approval_workflow.sql");
  assert.match(migration, /record_social_content_decision/);
  assert.match(migration, /current_app_role\(\) not in \('administrator', 'editor', 'reviewer'\)/);
  assert.match(migration, /status = 'ready_for_review'/);
  assert.match(migration, /insert into public\.social_content_approvals/);
  assert.match(migration, /content_hash/);
  assert.match(migration, /social_draft_human_decision_recorded/);
  assert.match(migration, /revoke all on function public\.record_social_content_decision/);
  assert.match(migration, /grant execute on function public\.record_social_content_decision/);
});

test("social draft foreign keys used by the workflow are indexed", async () => {
  const indexes = await read("supabase/migrations/20260719122500_social_draft_fk_indexes.sql");
  assert.match(indexes, /social_content_drafts \(updated_by\)/);
  assert.match(indexes, /social_content_drafts \(approved_by\)/);
});

test("the application exposes draft and review actions but no publish or schedule action", async () => {
  const actions = await read("app/social-drafts/actions.ts");
  const page = await read("app/social-drafts/page.tsx");
  assert.match(actions, /create_social_content_draft/);
  assert.match(actions, /submit_social_content_for_review/);
  assert.match(actions, /record_social_content_decision/);
  assert.doesNotMatch(actions, /publish|schedule|media_publish|\/feed/);
  assert.match(page, /Save private draft/);
  assert.match(page, /Approve this exact draft/);
  assert.match(page, /no publishing or scheduling capability/i);
});
