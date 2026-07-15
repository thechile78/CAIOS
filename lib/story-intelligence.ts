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

  const [{ data: sources }, { data: candidates }] = await Promise.all([
    supabase.from("story_sources").select("id,url,publisher,title,reliability,verified,created_at").eq("story_id", storyId).order("created_at", { ascending: false }),
    supabase.from("stories").select("id,title,desk,status,updated_at").neq("id", storyId).neq("status", "archived").limit(100),
  ]);

  const title = story.title as string;
  const summary = story.summary as string | null;
  const combined = `${title} ${summary ?? ""}`.toLowerCase();
  const houstonRelevant = /\bhouston\b|\bharris county\b|\btexas\b|\bkaty\b|\bpasadena\b|\bsugar land\b|\bthe woodlands\b/.test(combined) || String(story.desk).toLowerCase() === "houston";
  const urgencyTerms = /breaking|dead|dies|emergency|evacuat|warning|recall|outbreak|shooting|crash|hurricane|tornado|flood|arrest|lawsuit|announces|unveil|launch/.test(combined);
  const recommendedPriority = urgencyTerms && houstonRelevant ? "high" : urgencyTerms ? "high" : "normal";
  const sourceList = sources ?? [];
  const verifiedCount = sourceList.filter((source) => source.verified).length;
  const confidence = sourceList.length === 0 ? 20 : Math.min(95, 45 + sourceList.length * 12 + verifiedCount * 15);
  const similarStories = (candidates ?? [])
    .map((candidate) => ({ ...candidate, similarity: similarity(title, candidate.title) }))
    .filter((candidate) => candidate.similarity >= 0.28)
    .sort((a, b) => b.similarity - a.similarity)
    .slice(0, 5);

  return {
    story,
    sources: sourceList,
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
  };
}
