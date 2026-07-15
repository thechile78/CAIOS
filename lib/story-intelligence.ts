import "server-only";

import { createSupabaseServerClient } from "@/lib/supabase/server";

const stopWords = new Set(["the","a","an","and","or","but","for","to","of","in","on","at","with","from","is","are","was","were","be","this","that","it","as","by","after","before","new"]);

function tokens(value: string): Set<string> {
  return new Set(value.toLowerCase().replace(/[^a-z0-9\s]/g, " ").split(/\s+/).filter((word) => word.length > 2 && !stopWords.has(word)));
}

function similarity(a: string, b: string): number {
  const left = tokens(a);
  const right = tokens(b);
  if (!left.size || !right.size) return 0;
  let overlap = 0;
  for (const word of left) if (right.has(word)) overlap += 1;
  return overlap / new Set([...left, ...right]).size;
}

function sentence(value: string | null, fallback: string): string {
  const cleaned = (value ?? "").replace(/\s+/g, " ").trim();
  if (!cleaned) return fallback;
  const first = cleaned.match(/^.*?[.!?](?:\s|$)/)?.[0]?.trim() ?? cleaned;
  return first.slice(0, 320);
}

export async function getStoryIntelligence(storyId: string) {
  const supabase = await createSupabaseServerClient();
  const { data: story, error } = await supabase
    .from("stories")
    .select("id,title,desk,priority,status,summary,body,updated_at")
    .eq("id", storyId)
    .single();
  if (error || !story) return null;

  const [{ data: sources }, { data: candidates }, { data: checklist }, { data: approvals }] = await Promise.all([
    supabase.from("story_sources").select("id,url,publisher,title,reliability,verified,created_at").eq("story_id", storyId).order("created_at", { ascending: false }),
    supabase.from("stories").select("id,title,desk,status,updated_at").neq("id", storyId).neq("status", "archived").limit(100),
    supabase.from("editorial_checklists").select("story_id,sources_verified,facts_verified,rights_reviewed,seo_reviewed,human_approved,updated_at").eq("story_id", storyId).maybeSingle(),
    supabase.from("approvals").select("id,decision,note,created_at").eq("story_id", storyId).order("created_at", { ascending: false }).limit(10),
  ]);

  const title = story.title as string;
  const summary = story.summary as string | null;
  const body = story.body as string | null;
  const combined = `${title} ${summary ?? ""}`.toLowerCase();
  const houstonRelevant = /\bhouston\b|\bharris county\b|\btexas\b|\bkaty\b|\bpasadena\b|\bsugar land\b|\bthe woodlands\b/.test(combined) || String(story.desk).toLowerCase() === "houston";
  const urgencyTerms = /breaking|dead|dies|emergency|evacuat|warning|recall|outbreak|shooting|crash|hurricane|tornado|flood|arrest|lawsuit|announces|unveil|launch/.test(combined);
  const recommendedPriority = urgencyTerms ? "high" : "normal";
  const sourceList = sources ?? [];
  const verifiedCount = sourceList.filter((source) => source.verified).length;
  const confidence = sourceList.length === 0 ? 20 : Math.min(95, 45 + sourceList.length * 12 + verifiedCount * 15);
  const similarStories = (candidates ?? [])
    .map((candidate) => ({ ...candidate, similarity: similarity(title, candidate.title) }))
    .filter((candidate) => candidate.similarity >= 0.28)
    .sort((a, b) => b.similarity - a.similarity)
    .slice(0, 5);

  const highestSimilarity = similarStories[0]?.similarity ?? 0;
  const checks = [
    { key: "headline", label: "Headline length", passed: title.length >= 35 && title.length <= 90, detail: `${title.length} characters; target 35–90.` },
    { key: "summary", label: "Summary completeness", passed: (summary?.trim().length ?? 0) >= 80, detail: `${summary?.trim().length ?? 0} characters; target at least 80.` },
    { key: "body", label: "Draft body", passed: (body?.trim().length ?? 0) >= 300, detail: `${body?.trim().length ?? 0} characters; target at least 300 before approval.` },
    { key: "sources", label: "Source attribution", passed: sourceList.length > 0, detail: `${sourceList.length} source record${sourceList.length === 1 ? "" : "s"} attached.` },
    { key: "verification", label: "Independent verification", passed: verifiedCount > 0, detail: `${verifiedCount} source${verifiedCount === 1 ? "" : "s"} marked verified.` },
    { key: "duplicate", label: "Duplicate risk", passed: highestSimilarity < 0.55, detail: highestSimilarity ? `${Math.round(highestSimilarity * 100)}% highest title overlap.` : "No meaningful overlap detected." },
    { key: "checklist", label: "Editorial checklist", passed: Boolean(checklist?.sources_verified && checklist?.facts_verified && checklist?.rights_reviewed && checklist?.seo_reviewed), detail: checklist ? "Checklist progress is reflected live." : "Checklist has not been started." },
  ];
  const readinessScore = Math.round((checks.filter((check) => check.passed).length / checks.length) * 100);
  const readinessLabel = readinessScore >= 86 ? "Ready for approval review" : readinessScore >= 57 ? "Needs editorial work" : "Early-stage record";

  return {
    story,
    sources: sourceList,
    checklist: checklist ?? null,
    approvals: approvals ?? [],
    briefing: sentence(summary, title),
    whyItMatters: houstonRelevant
      ? "This has direct Houston or Texas relevance and may merit local editorial attention."
      : "This may fit the assigned desk, but local relevance and audience value still require human review.",
    houstonRelevant,
    recommendedPriority,
    confidence,
    verificationStatus: verifiedCount > 0 ? `${verifiedCount} verified source${verifiedCount === 1 ? "" : "s"}` : "No sources independently verified",
    suggestedHeadline: title.length <= 70 ? title : `${title.slice(0, 67).trim()}...`,
    metaDescription: sentence(summary, title).slice(0, 155),
    similarStories,
    scorecard: {
      score: readinessScore,
      label: readinessLabel,
      checks,
    },
  };
}
