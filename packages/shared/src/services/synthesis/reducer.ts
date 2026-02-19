import { z } from "zod";
import type { LLMProvider } from "../../providers/types.js";
import type {
  BatchExtractionResult,
  SynthesisResult,
  SynthesisSection,
  DeepDive,
} from "./types.js";

const REDUCE_PHASE_SYSTEM_PROMPT = `You are a synthesis master. Your job is to merge multiple batch extractions into a unified, coherent synthesis that directly answers the user's original query.

Given:
- Multiple batch extractions (each from analyzing a subset of bookmarks)
- The original user query
- Metadata about all bookmarks (title, url)

Produce:

1. SECTIONS (3-6): Create well-structured synthesis sections that answer the query.
   Section types:
   - core_concept: Fundamental ideas the user needs to understand
   - consensus: What sources generally agree on
   - debate: Areas of disagreement or ongoing discussion
   - practical_pattern: Actionable patterns or approaches
   - pitfall: Common mistakes or warnings
   - timeline: Temporal aspects or evolution

   For each section:
   - id: A kebab-case identifier (e.g., "ai-agent-definition")
   - type: One of the types above
   - title: Clear, descriptive heading (5-8 words)
   - content: 2-4 paragraphs of synthesized information
   - sourceBookmarkIds: Array of bookmark IDs that support this section (2-6 IDs)

2. DEEP DIVES (3-5): Recommend specific bookmarks for deeper reading.
   Select bookmarks that:
   - Offer unique perspectives not fully captured in sections
   - Provide especially detailed coverage of important subtopics
   - Are from authoritative or primary sources
   - Contain actionable, practical content

   For each deep dive:
   - bookmarkId: The ID of the recommended bookmark
   - title: The bookmark's title
   - url: The bookmark's URL
   - reason: 1-2 sentences explaining why this bookmark is worth deep reading

Guidelines:
- Prioritize synthesis over summarization - don't just list what each source says
- Explicitly connect ideas across sources
- Cite sources using their IDs (sourceBookmarkIds must be valid IDs from the input)
- Ensure deep dives reference real bookmarks from the metadata
- The synthesis should be comprehensive yet digestible`;

const reducePhaseResponseSchema = z.object({
  sections: z.array(
    z.object({
      id: z.string(),
      type: z.enum([
        "core_concept",
        "consensus",
        "debate",
        "practical_pattern",
        "pitfall",
        "timeline",
      ]),
      title: z.string(),
      content: z.string(),
      sourceBookmarkIds: z.array(z.string()),
    })
  ),
  deepDives: z.array(
    z.object({
      bookmarkId: z.string(),
      title: z.string(),
      url: z.string(),
      reason: z.string(),
    })
  ),
});

function buildReducePhasePrompt(
  extractions: BatchExtractionResult[],
  query: string,
  bookmarksMeta: Map<string, { title: string; url: string }>
): string {
  const bookmarkList = Array.from(bookmarksMeta.entries())
    .map(([id, meta]) => `- ${id}: "${meta.title}" (${meta.url})`)
    .join("\n");

  const extractionSummaries = extractions
    .map((extraction, idx) => {
      const themes = extraction.extractedThemes
        .map(
          (t) => `    - "${t.theme}" (confidence: ${t.confidence.toFixed(2)})`
        )
        .join("\n");

      const conflicts = extraction.conflicts
        .map(
          (c) =>
            `    - ${c.topic}: ${c.viewpoints
              .map((v) => `${v.bookmarkId} says "${v.stance}"`)
              .join(" vs ")}`
        )
        .join("\n");

      const patterns = extraction.patterns
        .map(
          (p) =>
            `    - ${p.type}: "${p.description}" (${p.relatedBookmarkIds.join(
              ", "
            )})`
        )
        .join("\n");

      return `Batch ${idx + 1} (bookmarks: ${extraction.bookmarkIds.join(
        ", "
      )}):
  Themes:\n${themes || "    (none)"}
  Conflicts:\n${conflicts || "    (none)"}
  Patterns:\n${patterns || "    (none)"}`;
    })
    .join("\n\n");

  return `User query: "${query}"

All bookmarks (${bookmarksMeta.size} total):
${bookmarkList}

Batch extractions (${extractions.length} batches):

${extractionSummaries}`;
}

export async function synthesizeFromExtractions(
  extractions: BatchExtractionResult[],
  query: string,
  bookmarksMeta: Map<string, { title: string; url: string }>,
  llmProvider: LLMProvider
): Promise<SynthesisResult> {
  if (extractions.length === 0) {
    return {
      query,
      sections: [],
      deepDives: [],
      metadata: {
        bookmarkCount: bookmarksMeta.size,
        generatedAt: new Date().toISOString(),
      },
    };
  }

  const result = await llmProvider.generateObject(
    [
      { role: "system", content: REDUCE_PHASE_SYSTEM_PROMPT },
      {
        role: "user",
        content: buildReducePhasePrompt(extractions, query, bookmarksMeta),
      },
    ],
    reducePhaseResponseSchema,
    { temperature: 0.4, maxTokens: 6000 }
  );

  // Validate that all sourceBookmarkIds and deepDive bookmarkIds reference real bookmarks
  const validBookmarkIds = new Set(bookmarksMeta.keys());

  const sections: SynthesisSection[] = result.sections.map((section) => ({
    id: section.id,
    type: section.type,
    title: section.title,
    content: section.content,
    sourceBookmarkIds: section.sourceBookmarkIds.filter((id) =>
      validBookmarkIds.has(id)
    ),
  }));

  const deepDives: DeepDive[] = result.deepDives
    .filter((dd) => validBookmarkIds.has(dd.bookmarkId))
    .map((dd) => {
      const meta = bookmarksMeta.get(dd.bookmarkId)!;
      return {
        bookmarkId: dd.bookmarkId,
        title: meta.title,
        url: meta.url,
        reason: dd.reason,
      };
    });

  return {
    query,
    sections,
    deepDives,
    metadata: {
      bookmarkCount: bookmarksMeta.size,
      generatedAt: new Date().toISOString(),
    },
  };
}
