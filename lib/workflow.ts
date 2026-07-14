import type { ApprovalChecklist, EditorialStage } from "@/lib/domain";

const transitions: Record<EditorialStage, readonly EditorialStage[]> = {
  Discovery: ["Verification"],
  Verification: ["Research", "Discovery"],
  Research: ["Draft", "Verification"],
  Draft: ["Fact Check", "Research"],
  "Fact Check": ["SEO Review", "Draft"],
  "SEO Review": ["Human Approval", "Draft"],
  "Human Approval": ["WordPress Draft", "SEO Review"],
  "WordPress Draft": ["Published", "Human Approval"],
  Published: [],
};

export function canTransition(from: EditorialStage, to: EditorialStage) {
  return transitions[from].includes(to);
}

export function publishingGate(checklist: ApprovalChecklist) {
  const requirements = {
    sourcesVerified: checklist.sourcesVerified,
    factsChecked: checklist.factsChecked,
    imageRightsCleared: checklist.imageRightsCleared,
    seoComplete: checklist.seoComplete,
    accessibilityReviewed: checklist.accessibilityReviewed,
    humanApproved: checklist.humanApproved,
  };

  const blockers = Object.entries(requirements)
    .filter(([, complete]) => !complete)
    .map(([requirement]) => requirement);

  return {
    allowed: blockers.length === 0,
    blockers,
  };
}

export function validateTransition(
  from: EditorialStage,
  to: EditorialStage,
  checklist: ApprovalChecklist,
) {
  if (!canTransition(from, to)) {
    return { allowed: false, blockers: [`Invalid transition: ${from} → ${to}`] };
  }

  if (to === "WordPress Draft") {
    return publishingGate(checklist);
  }

  return { allowed: true, blockers: [] as string[] };
}
