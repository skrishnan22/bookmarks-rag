import type { LLMProvider } from "../../providers/types.js";
import type { BookmarkRepository } from "../../repositories/bookmarks.js";
import type { BatchExtractionResult, SynthesisResult } from "./types.js";
import type { BatchBookmarkInput } from "./prompts.js";
import { extractInsightsFromBatch } from "./map-extractor.js";
import { synthesizeFromExtractions } from "./reducer.js";

const BATCH_SIZE = 8;

export async function runSynthesisPipeline(
  query: string,
  userId: string,
  searchResults: Array<{
    bookmarkId: string;
    chunkId: string;
    chunkContent: string;
    score: number;
  }>,
  deps: {
    bookmarkRepo: BookmarkRepository;
    llmProvider: LLMProvider;
    onPhaseChange?: (phase: "map" | "reduce") => Promise<void> | void;
  }
): Promise<SynthesisResult> {
  // 1. Group search results by bookmarkId, preserving chunk-level citation context
  const chunksByBookmark = new Map<
    string,
    Array<{ chunkId: string; content: string; score: number }>
  >();
  for (const result of searchResults) {
    const existing = chunksByBookmark.get(result.bookmarkId) ?? [];
    existing.push({
      chunkId: result.chunkId,
      content: result.chunkContent,
      score: result.score,
    });
    chunksByBookmark.set(result.bookmarkId, existing);
  }

  const sortedChunksByBookmark = new Map<
    string,
    Array<{ chunkId: string; content: string; score: number }>
  >();
  for (const [bookmarkId, chunks] of chunksByBookmark.entries()) {
    sortedChunksByBookmark.set(
      bookmarkId,
      chunks.slice().sort((a, b) => b.score - a.score)
    );
  }

  const bookmarkIds = Array.from(chunksByBookmark.keys());

  if (bookmarkIds.length === 0) {
    return {
      query,
      narrativeMarkdown: "",
      citationIndex: [],
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
        bookmarkCount: 0,
        generatedAt: new Date().toISOString(),
      },
    };
  }

  // 2. Fetch full bookmark records to get insights, title, url
  const bookmarksMap = await deps.bookmarkRepo.findByIdsForUser(
    userId,
    bookmarkIds
  );

  // 3. Build BatchBookmarkInput[] for the map phase
  const batchInputs: BatchBookmarkInput[] = bookmarkIds
    .map((id) => {
      const bookmark = bookmarksMap.get(id);
      if (!bookmark) return null;
      return {
        id,
        title: bookmark.title ?? "Untitled",
        url: bookmark.url,
        insights: bookmark.insights,
        matchedChunks: (sortedChunksByBookmark.get(id) ?? []).map(
          (chunk) => chunk.content
        ),
      };
    })
    .filter((b): b is BatchBookmarkInput => b !== null);

  const chunkCitationContext = new Map<
    string,
    Array<{ chunkId: string; snippet: string }>
  >();
  for (const [bookmarkId, sorted] of sortedChunksByBookmark.entries()) {
    chunkCitationContext.set(
      bookmarkId,
      sorted.map((chunk) => ({
        chunkId: chunk.chunkId,
        snippet: chunk.content,
      }))
    );
  }

  // 4. Split into batches of BATCH_SIZE
  const batches: BatchBookmarkInput[][] = [];
  for (let i = 0; i < batchInputs.length; i += BATCH_SIZE) {
    batches.push(batchInputs.slice(i, i + BATCH_SIZE));
  }

  // 5. Run map phase sequentially (avoid rate limits)
  if (deps.onPhaseChange) {
    await deps.onPhaseChange("map");
  }

  const extractions: BatchExtractionResult[] = [];
  for (const batch of batches) {
    const extraction = await extractInsightsFromBatch(
      batch,
      query,
      deps.llmProvider
    );
    extractions.push(extraction);
  }

  // 6. Build bookmarksMeta for the reduce phase
  const bookmarksMeta = new Map<string, { title: string; url: string }>();
  for (const input of batchInputs) {
    bookmarksMeta.set(input.id, { title: input.title, url: input.url });
  }

  // 7. Run reduce phase
  if (deps.onPhaseChange) {
    await deps.onPhaseChange("reduce");
  }

  const synthesisResult = await synthesizeFromExtractions(
    extractions,
    query,
    bookmarksMeta,
    chunkCitationContext,
    deps.llmProvider
  );

  return synthesisResult;
}
