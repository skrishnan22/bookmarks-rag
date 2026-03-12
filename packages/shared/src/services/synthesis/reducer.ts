import { z } from "zod";
import type { LLMProvider } from "../../providers/types.js";
import type {
  BatchExtractionResult,
  SynthesisResult,
  SynthesisSection,
  DeepDive,
  SynthesisCitation,
  NotebookBlock,
  SynthesisTrust,
} from "./types.js";

const REDUCE_PHASE_SYSTEM_PROMPT = `You are a learning co-tutor. Merge multiple batch extractions into a rigorous, teachable synthesis that helps the user learn the topic without reading every source.

Given:
- Multiple batch extractions (each from analyzing a subset of bookmarks)
- The original user query
- A numbered list of all bookmarks [1], [2], ... with title and URL

Produce:

0. NARRATIVE MARKDOWN:
   - narrativeMarkdown: a concise teaching brief in markdown.
   - Use these exact top-level headings:
     - ## Direct Answer
     - ## Why It Matters
     - ## Practical Guidance
     - ## Open Questions
   - Under each heading, write 2-4 bullets or short paragraphs.
   - Keep writing concrete and specific. Avoid generic filler.
   - Use inline citations like [2], [7] for factual claims.
   - If evidence is mixed, state uncertainty explicitly.

1. SECTIONS (4-8): Create high-signal synthesis sections that answer the query.
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
    - content: 3-5 paragraphs of synthesized analysis. Include:
      - what the idea is
      - why it matters
      - concrete implications or examples
      Use inline citations like [1], [3] for factual claims.
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

3. NOTEBOOK BLOCKS (8-14): Return tutor-style learning cards.
   Each block should have:
    - id: kebab-case identifier
    - type: one of "key_insight", "practical_takeaway", "tradeoff", "mental_model", "open_question"
    - title: concise heading
    - insight: 2-4 sentences with a concrete observation
    - whyItMatters: 1-2 sentences describing practical impact
    - howToApply: 1-3 sentences with an actionable next step
    - sourceBookmarkIndices: 1-4 integer bookmark refs [N]

   Citation rules:
   - Every block must include at least one sourceBookmarkIndex
   - Use diverse sources where possible

Guidelines:
- Prioritize synthesis over summarization — don't just list what each source says
- Explicitly connect ideas across sources using the supporting evidence provided
- Always reference bookmarks by their [N] number — never by UUID, title, or URL
- Use inline [N] citations in narrativeMarkdown and section content to attribute specific claims
- Each section must reference at least one bookmark number
- Aim for section type variety — avoid producing only core_concept and consensus sections
- Every important factual statement should be grounded in at least one source index
- Write with a teacher's clarity: concrete, comparative, and decision-useful`;

// LLM outputs integer indices ([1], [2], ...) — remapped to UUIDs after the call
const reducePhaseResponseSchema = z.object({
  narrativeMarkdown: z.string(),
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
  notebookBlocks: z.array(
    z.object({
      id: z.string(),
      type: z.enum([
        "key_insight",
        "practical_takeaway",
        "tradeoff",
        "mental_model",
        "open_question",
      ]),
      title: z.string(),
      insight: z.string(),
      whyItMatters: z.string(),
      howToApply: z.string(),
      sourceBookmarkIndices: z.array(z.number().int().min(1)).min(1),
    })
  ),
});

type BookmarkChunkCitationContext = Map<
  string,
  Array<{ chunkId: string; snippet: string }>
>;

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
  const idToLabelMap = new Map<string, string>();
  orderedBookmarkIds.forEach((id, idx) => {
    idToLabelMap.set(id, `[${idx + 1}]`);
  });
  const idToLabel = (id: string): string => idToLabelMap.get(id) ?? "[?]";

  const extractionSummaries = extractions
    .map((extraction, idx) => {
      const themes = extraction.extractedThemes
        .map((t) => {
          const evidence =
            t.supportingEvidence.length > 0
              ? `\n      Evidence: ${t.supportingEvidence.join(" | ")}`
              : "";
          const sources =
            t.relatedBookmarkIds.length > 0
              ? ` (sources: ${t.relatedBookmarkIds.map(idToLabel).join(", ")})`
              : "";
          return `    - "${t.theme}" (confidence: ${t.confidence.toFixed(2)})${sources}${evidence}`;
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
  citationContext: BookmarkChunkCitationContext,
  llmProvider: LLMProvider
): Promise<SynthesisResult> {
  const orderedBookmarkIds = Array.from(bookmarksMeta.keys());
  const citationIndex = buildCitationIndex(orderedBookmarkIds, bookmarksMeta);

  if (extractions.length === 0) {
    return {
      query,
      narrativeMarkdown: "",
      citationIndex,
      notebookBlocks: [],
      sections: [],
      deepDives: [],
      trust: {
        citationCoverage: 1,
        citedBlocks: 0,
        uncitedBlocks: 0,
        totalCitations: 0,
        sourceDiversity: 0,
      },
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
        content: buildReducePhasePrompt(
          extractions,
          query,
          bookmarksMeta,
          orderedBookmarkIds
        ),
      },
    ],
    reducePhaseResponseSchema,
    { temperature: 0.35, maxTokens: 11000 }
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
        .map((i) => {
          const id = indexToId(i);
          if (!id) {
            console.warn(
              `[synthesis:reduce] Invalid bookmark index ${i} in section "${section.id}" (total bookmarks: ${orderedBookmarkIds.length})`
            );
          }
          return id;
        })
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
      if (!id) {
        console.warn(
          `[synthesis:reduce] Invalid bookmark index ${dd.bookmarkIndex} in deepDive (total bookmarks: ${orderedBookmarkIds.length})`
        );
        return null;
      }
      const meta = bookmarksMeta.get(id)!;
      return {
        bookmarkId: id,
        title: meta.title,
        url: meta.url,
        reason: dd.reason,
      };
    })
    .filter((dd): dd is DeepDive => dd !== null);

  const notebookBlocks: NotebookBlock[] = result.notebookBlocks
    .map((block) => {
      const sourceBookmarkIds = dedupe(
        block.sourceBookmarkIndices
          .map((i) => {
            const id = indexToId(i);
            if (!id) {
              console.warn(
                `[synthesis:reduce] Invalid bookmark index ${i} in notebook block "${block.id}" (total bookmarks: ${orderedBookmarkIds.length})`
              );
            }
            return id;
          })
          .filter((id): id is string => id !== null)
      );

      const citations = buildBlockCitations(
        sourceBookmarkIds,
        bookmarksMeta,
        citationContext
      );

      return {
        id: block.id,
        type: block.type,
        title: block.title,
        insight: block.insight,
        whyItMatters: block.whyItMatters,
        howToApply: block.howToApply,
        sourceBookmarkIds,
        citations,
      };
    })
    .filter((block) => {
      if (requiresCitation(block.type) && block.citations.length === 0) {
        console.warn(
          `[synthesis] Notebook block "${block.id}" requires citations but none were available after mapping — dropping`
        );
        return false;
      }
      return true;
    });

  const trust = buildTrustMetadata(notebookBlocks);

  return {
    query,
    narrativeMarkdown: result.narrativeMarkdown,
    citationIndex,
    notebookBlocks,
    sections,
    deepDives,
    trust,
    metadata: {
      bookmarkCount: bookmarksMeta.size,
      generatedAt: new Date().toISOString(),
    },
  };
}

function dedupe(values: string[]): string[] {
  return [...new Set(values)];
}

function requiresCitation(type: NotebookBlock["type"]): boolean {
  return type !== "open_question";
}

function buildCitationIndex(
  orderedBookmarkIds: string[],
  bookmarksMeta: Map<string, { title: string; url: string }>
): SynthesisCitation[] {
  return orderedBookmarkIds
    .map((bookmarkId, idx) => {
      const meta = bookmarksMeta.get(bookmarkId);
      if (!meta) {
        return null;
      }

      return {
        index: idx + 1,
        bookmarkId,
        title: meta.title,
        url: meta.url,
      };
    })
    .filter((citation): citation is SynthesisCitation => citation !== null);
}

function buildTrustMetadata(notebookBlocks: NotebookBlock[]): SynthesisTrust {
  const required = notebookBlocks.filter((block) =>
    requiresCitation(block.type)
  );
  const citedBlocks = required.filter(
    (block) => block.citations.length > 0
  ).length;
  const uncitedBlocks = required.length - citedBlocks;
  const citationCoverage =
    required.length === 0 ? 1 : citedBlocks / required.length;
  const totalCitations = notebookBlocks.reduce(
    (sum, block) => sum + block.citations.length,
    0
  );
  const sourceDiversity = new Set(
    notebookBlocks.flatMap((block) =>
      block.citations.map((citation) => citation.bookmarkId)
    )
  ).size;

  return {
    citationCoverage,
    citedBlocks,
    uncitedBlocks,
    totalCitations,
    sourceDiversity,
  };
}

function buildBlockCitations(
  sourceBookmarkIds: string[],
  bookmarksMeta: Map<string, { title: string; url: string }>,
  citationContext: BookmarkChunkCitationContext
): NotebookBlock["citations"] {
  const citations: NotebookBlock["citations"] = [];

  for (const bookmarkId of sourceBookmarkIds) {
    const meta = bookmarksMeta.get(bookmarkId);
    if (!meta) {
      continue;
    }

    const chunkEntries = citationContext.get(bookmarkId) ?? [];
    const topChunk = chunkEntries[0];
    if (!topChunk) {
      continue;
    }

    citations.push({
      bookmarkId,
      chunkId: topChunk.chunkId,
      title: meta.title,
      url: meta.url,
      snippet: compactSnippet(topChunk.snippet),
    });
  }

  return citations;
}

function compactSnippet(value: string): string {
  const trimmed = value.replace(/\s+/g, " ").trim();
  if (trimmed.length <= 220) {
    return trimmed;
  }

  return `${trimmed.slice(0, 217)}...`;
}
