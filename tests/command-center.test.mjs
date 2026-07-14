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
