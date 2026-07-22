import test from "node:test";
import assert from "node:assert/strict";

const workflow = [
  "Discovery",
  "Verification",
  "Research",
  "Draft",
  "Fact Check",
  "SEO Review",
  "Human Approval",
  "WordPress Draft",
];

test("human approval precedes WordPress draft", () => {
  const approvalIndex = workflow.indexOf("Human Approval");
  const wordpressIndex = workflow.indexOf("WordPress Draft");

  assert.ok(approvalIndex >= 0);
  assert.ok(wordpressIndex >= 0);
  assert.ok(approvalIndex < wordpressIndex);
});

test("workflow does not include automatic publishing", () => {
  assert.equal(workflow.includes("Publish"), false);
  assert.equal(workflow.includes("Auto Publish"), false);
});

test("founder dashboard keeps publishing authority human-gated", async () => {
  const source = await import("node:fs/promises").then((fs) => fs.readFile("components/founder-dashboard.tsx", "utf8"));

  assert.match(source, /The Chile approval required/);
  assert.match(source, /No automatic publishing/);
  assert.doesNotMatch(source, /Auto Publish/);
});
