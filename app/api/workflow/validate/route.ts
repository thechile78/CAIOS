import { NextResponse } from "next/server";
import { editorialStages, type ApprovalChecklist, type EditorialStage } from "@/lib/domain";
import { validateTransition } from "@/lib/workflow";

function isStage(value: unknown): value is EditorialStage {
  return typeof value === "string" && editorialStages.includes(value as EditorialStage);
}

function isChecklist(value: unknown): value is ApprovalChecklist {
  if (!value || typeof value !== "object") return false;
  const checklist = value as Record<string, unknown>;
  return [
    "sourcesVerified",
    "factsChecked",
    "imageRightsCleared",
    "seoComplete",
    "accessibilityReviewed",
    "humanApproved",
  ].every((key) => typeof checklist[key] === "boolean");
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);

  if (!body || !isStage(body.from) || !isStage(body.to) || !isChecklist(body.checklist)) {
    return NextResponse.json(
      { ok: false, error: "Invalid workflow validation request." },
      { status: 400 },
    );
  }

  const result = validateTransition(body.from, body.to, body.checklist);

  return NextResponse.json({
    ok: true,
    data: result,
  });
}
