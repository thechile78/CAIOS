import test from "node:test";
import assert from "node:assert/strict";

const stages = [
  "Discovery",
  "Verification",
  "Research",
  "Draft",
  "Fact Check",
  "SEO Review",
  "Human Approval",
  "WordPress Draft",
  "Published",
];

function gate(checklist) {
  const blockers = Object.entries(checklist)
    .filter(([, complete]) => !complete)
    .map(([name]) => name);
  return { allowed: blockers.length === 0, blockers };
}

test("human approval precedes WordPress Draft", () => {
  assert.ok(stages.indexOf("Human Approval") < stages.indexOf("WordPress Draft"));
});

test("publishing gate blocks missing human approval", () => {
  const result = gate({
    sourcesVerified: true,
    factsChecked: true,
    imageRightsCleared: true,
    seoComplete: true,
    accessibilityReviewed: true,
    humanApproved: false,
  });

  assert.equal(result.allowed, false);
  assert.deepEqual(result.blockers, ["humanApproved"]);
});

test("publishing gate opens only after every requirement is complete", () => {
  const result = gate({
    sourcesVerified: true,
    factsChecked: true,
    imageRightsCleared: true,
    seoComplete: true,
    accessibilityReviewed: true,
    humanApproved: true,
  });

  assert.equal(result.allowed, true);
  assert.deepEqual(result.blockers, []);
});
