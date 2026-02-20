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

export const SynthesisResultSchema = z.object({
  query: z.string(),
  sections: z.array(SynthesisSectionSchema),
  deepDives: z.array(DeepDiveSchema),
  metadata: z.object({
    bookmarkCount: z.number(),
    generatedAt: z.string(),
  }),
});

export type SynthesisSection = z.infer<typeof SynthesisSectionSchema>;
export type DeepDive = z.infer<typeof DeepDiveSchema>;
export type SynthesisResult = z.infer<typeof SynthesisResultSchema>;

export interface BatchExtractionResult {
  bookmarkIds: string[];
  extractedThemes: Array<{
    theme: string;
    description: string;
    supportingEvidence: string[];
    confidence: number;
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
