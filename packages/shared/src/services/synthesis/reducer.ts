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
- A numbered list of all bookmarks [1], [2], ... with title and URL

Produce:

1. SECTIONS (3-7): Create well-structured synthesis sections that answer the query.
   Choose section types that best fit the content — aim for variety:
   - core_concept: Fundamental ideas the user needs to understand
   - consensus: What sources generally agree on
   - debate: Areas of disagreement or ongoing discussion
   - practical_pattern: Actionable patterns or approaches
   - pitfall: Common mistakes, tradeoffs, or warnings
   - timeline: Temporal aspects, evolution, or history of a topic
   - comparison: Side-by-side analysis of tools, approaches, or competing ideas
   - mental_model: A framework or lens for thinking about the topic

   For each section:
   - id: A kebab-case identifier (e.g., "ai-agent-definition")
   - type: One of the types above
   - title: Clear, descriptive heading (5-8 words)
   - content: 2-4 paragraphs of synthesized information drawing on the evidence in the extractions
   - sourceBookmarkIndices: Array of integers (the [N] numbers from the "All bookmarks" list) that support this section (minimum 1, ideally 2-4)

2. DEEP DIVES (3-5): Recommend specific bookmarks for deeper reading.
   Select bookmarks that:
   - Offer unique perspectives not fully captured in sections
   - Provide especially detailed coverage of important subtopics
   - Are from authoritative or primary sources
   - Contain actionable, practical content

   For each deep dive:
   - bookmarkIndex: The integer [N] from the "All bookmarks" list
   - reason: 1-2 sentences explaining why this bookmark is worth deep reading

Guidelines:
- Prioritize synthesis over summarization — don't just list what each source says
- Explicitly connect ideas across sources using the supporting evidence provided
- Always reference bookmarks by their [N] number — never by UUID, title, or URL
- Each section must reference at least one bookmark number
- Aim for section type variety — avoid producing only core_concept and consensus sections
- The synthesis should be comprehensive yet digestible`;

// LLM outputs integer indices ([1], [2], ...) — remapped to UUIDs after the call
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
        "comparison",
        "mental_model",
      ]),
      title: z.string(),
      content: z.string(),
      sourceBookmarkIndices: z.array(z.number().int().min(1)),
    })
  ),
  deepDives: z.array(
    z.object({
      bookmarkIndex: z.number().int().min(1),
      reason: z.string(),
    })
  ),
});

function buildReducePhasePrompt(
  extractions: BatchExtractionResult[],
  query: string,
  bookmarksMeta: Map<string, { title: string; url: string }>,
  orderedBookmarkIds: string[]
): string {
  const bookmarkList = orderedBookmarkIds
    .map((id, idx) => {
      const meta = bookmarksMeta.get(id);
      return `[${idx + 1}] "${meta?.title ?? "Untitled"}" (${meta?.url ?? ""})`;
    })
    .join("\n");

  // Helper: convert a UUID to its [N] label for human-readable context
  const idToLabel = (id: string): string => {
    const idx = orderedBookmarkIds.indexOf(id);
    return idx >= 0 ? `[${idx + 1}]` : "[?]";
  };

  const extractionSummaries = extractions
    .map((extraction, idx) => {
      const themes = extraction.extractedThemes
        .map((t) => {
          const evidence =
            t.supportingEvidence.length > 0
              ? `\n      Evidence: ${t.supportingEvidence.join(" | ")}`
              : "";
          return `    - "${t.theme}" (confidence: ${t.confidence.toFixed(2)})${evidence}`;
        })
        .join("\n");

      const conflicts = extraction.conflicts
        .map(
          (c) =>
            `    - ${c.topic}: ${c.viewpoints
              .map((v) => `${idToLabel(v.bookmarkId)} says "${v.stance}"`)
              .join(" vs ")}`
        )
        .join("\n");

      const patterns = extraction.patterns
        .map(
          (p) =>
            `    - ${p.type}: "${p.description}" (${p.relatedBookmarkIds
              .map(idToLabel)
              .join(", ")})`
        )
        .join("\n");

      const batchLabels = extraction.bookmarkIds.map(idToLabel).join(", ");

      return `Batch ${idx + 1} (bookmarks: ${batchLabels}):
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

  // Stable ordered array used to map [N] indices → UUIDs deterministically
  const orderedBookmarkIds = Array.from(bookmarksMeta.keys());

  const result = await llmProvider.generateObject(
    [
      { role: "system", content: REDUCE_PHASE_SYSTEM_PROMPT },
      {
        role: "user",
        content: buildReducePhasePrompt(
          extractions,
          query,
          bookmarksMeta,
          orderedBookmarkIds
        ),
      },
    ],
    reducePhaseResponseSchema,
    { temperature: 0.4, maxTokens: 6000 }
  );

  // Deterministically remap 1-based indices to real bookmark UUIDs
  function indexToId(index: number): string | null {
    return orderedBookmarkIds[index - 1] ?? null;
  }

  const sections: SynthesisSection[] = result.sections
    .map((section) => ({
      id: section.id,
      type: section.type,
      title: section.title,
      content: section.content,
      sourceBookmarkIds: section.sourceBookmarkIndices
        .map(indexToId)
        .filter((id): id is string => id !== null),
    }))
    .filter((section) => {
      if (section.sourceBookmarkIds.length === 0) {
        console.warn(
          `[synthesis] Section "${section.id}" has no valid sourceBookmarkIds after index mapping — dropping`
        );
        return false;
      }
      return true;
    });

  const deepDives: DeepDive[] = result.deepDives
    .map((dd) => {
      const id = indexToId(dd.bookmarkIndex);
      if (!id) return null;
      const meta = bookmarksMeta.get(id)!;
      return {
        bookmarkId: id,
        title: meta.title,
        url: meta.url,
        reason: dd.reason,
      };
    })
    .filter((dd): dd is DeepDive => dd !== null);

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
