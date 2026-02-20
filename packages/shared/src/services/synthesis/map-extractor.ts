import { z } from "zod";
import type { LLMProvider } from "../../providers/types.js";
import type { BatchExtractionResult } from "./types.js";
import {
  buildMapPhasePrompt,
  type BatchBookmarkInput,
  MAP_PHASE_SYSTEM_PROMPT,
} from "./prompts.js";

// LLM outputs integer indices ([1], [2], ...) — remapped to UUIDs after the call
const mapExtractionResponseSchema = z.object({
  extractedThemes: z.array(
    z.object({
      theme: z.string(),
      description: z.string(),
      supportingEvidence: z.array(z.string()),
      confidence: z.number().min(0).max(1),
    })
  ),
  conflicts: z.array(
    z.object({
      topic: z.string(),
      viewpoints: z.array(
        z.object({
          bookmarkIndex: z.number().int().min(1),
          stance: z.string(),
        })
      ),
    })
  ),
  patterns: z.array(
    z.object({
      type: z.enum(["consensus", "disagreement", "unique_perspective"]),
      description: z.string(),
      relatedBookmarkIndices: z.array(z.number().int().min(1)),
    })
  ),
});

function indexToId(
  index: number,
  bookmarks: BatchBookmarkInput[]
): string | null {
  const bookmark = bookmarks[index - 1];
  return bookmark?.id ?? null;
}

export async function extractInsightsFromBatch(
  bookmarks: BatchBookmarkInput[],
  query: string,
  llmProvider: LLMProvider
): Promise<BatchExtractionResult> {
  if (bookmarks.length === 0) {
    return {
      bookmarkIds: [],
      extractedThemes: [],
      conflicts: [],
      patterns: [],
    };
  }

  const result = await llmProvider.generateObject(
    [
      { role: "system", content: MAP_PHASE_SYSTEM_PROMPT },
      { role: "user", content: buildMapPhasePrompt(bookmarks, query) },
    ],
    mapExtractionResponseSchema,
    { temperature: 0.3, maxTokens: 4000 }
  );

  // Deterministically remap 1-based indices to real bookmark UUIDs
  const conflicts = result.conflicts.map((c) => ({
    topic: c.topic,
    viewpoints: c.viewpoints
      .map((v) => {
        const id = indexToId(v.bookmarkIndex, bookmarks);
        return id ? { bookmarkId: id, stance: v.stance } : null;
      })
      .filter((v): v is { bookmarkId: string; stance: string } => v !== null),
  }));

  const patterns = result.patterns.map((p) => ({
    type: p.type,
    description: p.description,
    relatedBookmarkIds: p.relatedBookmarkIndices
      .map((i) => indexToId(i, bookmarks))
      .filter((id): id is string => id !== null),
  }));

  return {
    bookmarkIds: bookmarks.map((b) => b.id),
    extractedThemes: result.extractedThemes,
    conflicts,
    patterns,
  };
}
