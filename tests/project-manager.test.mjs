import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");
const source = await read("lib/project-manager.ts");
const repository = await read("lib/project-manager-repository.ts");
const dashboard = await read("components/founder-dashboard.tsx");
const page = await read("app/page.tsx");
const actions = await read("app/project-manager/actions.ts");
const migration = await read("supabase/migrations/20260722225548_project_manager_persistence.sql");

test("project manager exposes a reusable persisted work-item model", () => {
  assert.match(source, /export type WorkItem =/);
  assert.match(source, /export type GitHubLinkage =/);
  assert.match(source, /workItemStatuses/);
  assert.match(source, /scope: "internal_work"/);
  assert.match(source, /externalActionAuthorized: false/);
  assert.doesNotMatch(source, /projectWorkItems\s*:/);
});

test("project manager loads persisted rows through the authenticated Supabase client", () => {
  assert.match(repository, /createSupabaseServerClient/);
  assert.match(repository, /\.from\("project_work_items"\)/);
  assert.match(repository, /approval_scope !== "internal_work"/);
  assert.match(repository, /external_action_authorized !== false/);
  assert.match(page, /listProjectWorkItems\(\)/);
  assert.match(page, /roleCanAdminister/);
  assert.match(page, /workItems=\{projectWorkItems\}/);
});

test("database schema keeps Project Manager private and approval-gated", () => {
  assert.match(migration, /alter table public\.project_work_items enable row level security/);
  assert.match(migration, /alter table public\.project_work_item_approvals enable row level security/);
  assert.match(migration, /revoke all on table public\.project_work_items from anon, authenticated/);
  assert.match(migration, /grant select, insert, update on table public\.project_work_items to authenticated/);
  assert.match(migration, /public\.current_app_role\(\) = 'administrator'/);
  assert.match(migration, /Matching append-only internal approval is required/);
  assert.match(migration, /status = 'Founder Review'/);
  assert.match(migration, /p_expected_updated_at/);
});

test("project approval is append-only and cannot authorize external actions", () => {
  assert.match(migration, /approval_scope text not null default 'internal_work' check \(approval_scope = 'internal_work'\)/);
  assert.match(migration, /external_action_authorized boolean not null default false check \(external_action_authorized = false\)/);
  assert.doesNotMatch(migration, /grant (update|delete).*project_work_item_approvals/i);
  assert.doesNotMatch(migration, /create policy[^;]+project_work_item_approvals for (update|delete)/is);
  assert.doesNotMatch(migration, /(insert into|update|delete from) public\.(publication_records|social_content_[a-z_]+|wordpress_[a-z_]+)/i);
});

test("administrator-only server actions use database RPCs and optimistic concurrency", () => {
  assert.match(actions, /requireRole\(administratorRoles\)/);
  assert.match(actions, /create_project_work_item/);
  assert.match(actions, /update_project_work_item_status/);
  assert.match(actions, /record_project_work_item_decision/);
  assert.match(actions, /p_expected_updated_at/);
  assert.doesNotMatch(actions, /SUPABASE_SERVICE_ROLE_KEY/);
  assert.doesNotMatch(actions, /publish|schedule|dispatch|deploy/i);
});

test("founder dashboard preserves the Kanban, brief, and human approval boundary", () => {
  assert.match(dashboard, /Project Manager/);
  assert.match(dashboard, /Persisted Kanban view/);
  assert.match(dashboard, /Founder Brief/);
  assert.match(dashboard, /GitHub linkage placeholders/);
  assert.match(dashboard, /Human approval gate enforced/);
  assert.match(dashboard, /Approve internal work/);
  assert.match(dashboard, /for internal work only/);
  assert.doesNotMatch(dashboard, /Auto Publish/);
});
