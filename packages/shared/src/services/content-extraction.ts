import { z } from "zod";
import type { LLMProvider } from "../providers/types.js";

const MAX_INPUT_CHARS = 48000;
const MIN_CONFIDENCE = 0.5;

const extractedEntitySchema = z.object({
  type: z.enum(["book", "movie", "tv_show"]),
  name: z.string(),
  contextSnippet: z.string(),
  confidence: z.number().min(0).max(1),
});

const contentExtractionResponseSchema = z.object({
  summary: z.string(),
  entities: z.array(extractedEntitySchema),
});

export type ExtractedEntity = z.infer<typeof extractedEntitySchema>;

export interface ContentExtractionResult {
  summary: string;
  entities: ExtractedEntity[];
}

const SYSTEM_PROMPT = `You are a content analysis assistant. Analyze the provided webpage and:

1. SUMMARY: Write a clear 3-5 sentence summary capturing:
   - What the page is about
   - Key information or takeaways

2. ENTITY EXTRACTION: Extract books, movies, and TV shows mentioned in the content.

Entity extraction rules:
- Only extract entities the author is recommending, reviewing, or discussing substantively
- Ignore passing mentions, metaphors, or examples (e.g., "This startup is the Uber of..." - don't extract Uber)
- Include a context snippet of ~100 characters around each mention
- Assign confidence based on clarity:
  - >0.8: Clear recommendation or review
  - 0.5-0.8: Substantive discussion
  - <0.5: Passing mention (exclude these)

Entity types:
- book: Books, novels, textbooks, guides
- movie: Films, documentaries
- tv_show: TV series, web series, limited series

If an entity could be both book and movie (e.g., "Dune"), extract as the type most relevant to context.

Return empty entities array if no qualifying entities found.`;

function buildUserPrompt(title: string, markdown: string, url: string): string {
  const truncated =
    markdown.length > MAX_INPUT_CHARS
      ? markdown.slice(0, MAX_INPUT_CHARS) + "\n\n[Content truncated...]"
      : markdown;

  return `Analyze this webpage:

Title: ${title}
URL: ${url}

Content:
${truncated}`;
}

function dedupeEntities(entities: ExtractedEntity[]): ExtractedEntity[] {
  const seen = new Map<string, ExtractedEntity>();

  for (const entity of entities) {
    const key = `${entity.type}:${entity.name.toLowerCase()}`;
    const existing = seen.get(key);

    if (!existing || entity.confidence > existing.confidence) {
      seen.set(key, entity);
    }
  }

  return Array.from(seen.values());
}

export async function extractSummaryAndEntities(
  markdown: string,
  title: string,
  url: string,
  llmProvider: LLMProvider
): Promise<ContentExtractionResult> {
  if (!markdown || markdown.trim().length < 100) {
    return { summary: "", entities: [] };
  }

  const result = await llmProvider.generateObject(
    [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: buildUserPrompt(title, markdown, url) },
    ],
    contentExtractionResponseSchema,
    { temperature: 0.2, maxTokens: 2500 }
  );

  const filteredEntities = result.entities.filter(
    (e) => e.confidence >= MIN_CONFIDENCE
  );

  return {
    summary: result.summary.trim(),
    entities: dedupeEntities(filteredEntities),
  };
}
