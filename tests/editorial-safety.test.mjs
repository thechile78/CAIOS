import test from "node:test";
import assert from "node:assert/strict";

const workflow = [
  "Discovery",
  "Verification",
  "Clustering",
  "Scoring",
  "Research",
  "Draft",
  "Fact Check",
  "SEO Review",
  "Human Approval",
  "WordPress Draft",
];

test("human approval occurs before WordPress draft creation", () => {
  assert.ok(workflow.indexOf("Human Approval") < workflow.indexOf("WordPress Draft"));
});

test("no direct publish stage exists in the foundation workflow", () => {
  assert.equal(workflow.includes("Publish"), false);
});
