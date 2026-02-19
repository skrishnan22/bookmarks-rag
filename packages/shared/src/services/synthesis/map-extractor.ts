import { z } from "zod";
import type { LLMProvider } from "../../providers/types.js";
import type { BatchExtractionResult } from "./types.js";
import {
  buildMapPhasePrompt,
  type BatchBookmarkInput,
  MAP_PHASE_SYSTEM_PROMPT,
} from "./prompts.js";

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
          bookmarkId: z.string(),
          stance: z.string(),
        })
      ),
    })
  ),
  patterns: z.array(
    z.object({
      type: z.enum(["consensus", "disagreement", "unique_perspective"]),
      description: z.string(),
      relatedBookmarkIds: z.array(z.string()),
    })
  ),
});

export type MapExtractionResponse = z.infer<typeof mapExtractionResponseSchema>;

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

  return {
    bookmarkIds: bookmarks.map((b) => b.id),
    extractedThemes: result.extractedThemes,
    conflicts: result.conflicts,
    patterns: result.patterns,
  };
}
