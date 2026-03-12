import { z } from "zod";

export const SynthesisSectionSchema = z.object({
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
  sourceBookmarkIds: z.array(z.string()),
});

export const DeepDiveSchema = z.object({
  bookmarkId: z.string(),
  title: z.string(),
  url: z.string(),
  reason: z.string(),
});

export const SynthesisCitationSchema = z.object({
  index: z.number().int().min(1),
  bookmarkId: z.string(),
  title: z.string(),
  url: z.string(),
});

export const NotebookBlockSchema = z.object({
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
  sourceBookmarkIds: z.array(z.string()),
  citations: z.array(
    z.object({
      bookmarkId: z.string(),
      chunkId: z.string(),
      title: z.string(),
      url: z.string(),
      snippet: z.string(),
    })
  ),
});

export const SynthesisTrustSchema = z.object({
  citationCoverage: z.number(),
  citedBlocks: z.number(),
  uncitedBlocks: z.number(),
  totalCitations: z.number(),
  sourceDiversity: z.number(),
});

export const SynthesisResultSchema = z.object({
  query: z.string(),
  narrativeMarkdown: z.string(),
  citationIndex: z.array(SynthesisCitationSchema),
  notebookBlocks: z.array(NotebookBlockSchema),
  sections: z.array(SynthesisSectionSchema),
  deepDives: z.array(DeepDiveSchema),
  trust: SynthesisTrustSchema,
  metadata: z.object({
    bookmarkCount: z.number(),
    generatedAt: z.string(),
  }),
});

export type SynthesisSection = z.infer<typeof SynthesisSectionSchema>;
export type DeepDive = z.infer<typeof DeepDiveSchema>;
export type SynthesisCitation = z.infer<typeof SynthesisCitationSchema>;
export type NotebookBlock = z.infer<typeof NotebookBlockSchema>;
export type SynthesisTrust = z.infer<typeof SynthesisTrustSchema>;
export type SynthesisResult = z.infer<typeof SynthesisResultSchema>;

export interface BatchExtractionResult {
  bookmarkIds: string[];
  extractedThemes: Array<{
    theme: string;
    description: string;
    supportingEvidence: string[];
    confidence: number;
    relatedBookmarkIds: string[];
  }>;
  conflicts: Array<{
    topic: string;
    viewpoints: Array<{
      bookmarkId: string;
      stance: string;
    }>;
  }>;
  patterns: Array<{
    type: "consensus" | "disagreement" | "unique_perspective";
    description: string;
    relatedBookmarkIds: string[];
  }>;
}
