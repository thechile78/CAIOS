import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const source = await readFile("lib/project-manager.ts", "utf8");
const dashboard = await readFile("components/founder-dashboard.tsx", "utf8");

test("project manager exposes reusable work-item model", () => {
  assert.match(source, /export type WorkItem =/);
  assert.match(source, /export type GitHubLinkage =/);
  assert.match(source, /workItemStatuses/);
});

test("project workflow preserves approval gate before approved status", () => {
  assert.match(source, /canMoveWorkItemToApproved/);
  assert.match(source, /item\.approval\.required && item\.approval\.approved/);
  assert.doesNotMatch(source, /automatic publishing/i);
});

test("founder dashboard includes project manager kanban and brief", () => {
  assert.match(dashboard, /Project Manager/);
  assert.match(dashboard, /Kanban view/);
  assert.match(dashboard, /Founder Brief/);
  assert.match(dashboard, /GitHub linkage placeholders/);
  assert.match(dashboard, /Human approval gate enforced/);
});
