import type { BookmarkInsights } from "../../db/schema.js";

export interface BatchBookmarkInput {
  id: string;
  title: string;
  url: string;
  insights: BookmarkInsights | null;
  matchedChunks: string[];
}

export const MAP_PHASE_SYSTEM_PROMPT = `You are a synthesis assistant. Analyze the provided bookmarks in the context of the user's search query.

Each bookmark is numbered [1], [2], etc. Reference bookmarks using their number only.

For each batch of bookmarks, extract:

1. THEMES: Identify 2-4 major themes or concepts that appear across these bookmarks.
   For each theme:
   - theme: A short, descriptive name (2-4 words)
   - description: 1-2 sentences explaining the theme
   - supportingEvidence: 1-2 direct quotes or specific claims, each prefixed with the bookmark number, e.g. "[2] LLMs work best with structured prompts"
   - confidence: 0.0-1.0 score based on how clearly the theme emerges
   - relatedBookmarkIndices: Array of integers (the [N] numbers) for bookmarks that contribute to this theme

2. CONFLICTS: Identify any disagreements, debates, or contradictory viewpoints between bookmarks on the same topic.
   For each conflict:
   - topic: What is being debated/disagreed upon
   - viewpoints: Array of positions, each with a bookmarkIndex (the integer from [N]) and a one-sentence stance summary

3. PATTERNS: Identify structural patterns in the content.
   For each pattern:
   - type: One of "consensus" (agreement across sources), "disagreement" (conflicting views), or "unique_perspective" (only one source makes this point)
   - description: What the pattern is
   - relatedBookmarkIndices: Array of integers (the [N] numbers) for bookmarks that exhibit this pattern

Guidelines:
- Focus only on content relevant to the user's query
- Always reference bookmarks by their [N] number — never by title or URL
- supportingEvidence should be direct quotes where possible, prefixed with [N], not paraphrases
- Confidence scores should reflect certainty, not importance
- Return empty arrays if no themes/conflicts/patterns are found`;

export function buildMapPhasePrompt(
  bookmarks: BatchBookmarkInput[],
  query: string
): string {
  const bookmarkSummaries = bookmarks
    .map((b, idx) => {
      const chunks =
        b.matchedChunks.length > 0
          ? `\nMatched content:\n${b.matchedChunks.slice(0, 2).join("\n---\n")}`
          : "";

      const insights = b.insights
        ? `\nKey insights:\n- Main claims: ${b.insights.mainClaims.join("; ")}\n- Topics: ${b.insights.topics.join(", ")}${b.insights.uniqueAngle ? `\n- Unique angle: ${b.insights.uniqueAngle}` : ""}${b.insights.keyQuotes.length > 0 ? `\n- Key quotes: ${b.insights.keyQuotes.join(" | ")}` : ""}`
        : "";

      return `[${idx + 1}] ${b.title}\nURL: ${b.url}${insights}${chunks}`;
    })
    .join("\n\n");

  return `User query: "${query}"

Bookmarks to analyze (${bookmarks.length} total):

${bookmarkSummaries}`;
}
