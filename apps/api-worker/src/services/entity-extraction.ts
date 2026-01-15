import { z } from "zod";
import type { LLMProvider } from "../providers/types.js";
import type { EntityType } from "../db/schema.js";

const MAX_INPUT_CHARS = 48000;
const MIN_CONFIDENCE = 0.5;

const extractedEntitySchema = z.object({
  type: z.enum(["book", "movie", "tv_show"]),
  name: z.string(),
  contextSnippet: z.string(),
  confidence: z.number().min(0).max(1),
});

const extractionResponseSchema = z.object({
  entities: z.array(extractedEntitySchema),
});

export interface ExtractedEntity {
  type: EntityType;
  name: string;
  contextSnippet: string;
  confidence: number;
}

const SYSTEM_PROMPT = `You are an entity extraction assistant. Extract books, movies, and TV shows mentioned in the provided content.

Rules:
1. Only extract entities the author is recommending, reviewing, or discussing substantively
2. Ignore passing mentions, metaphors, or examples (e.g., "This startup is the Uber of..." - don't extract Uber)
3. Include a context snippet of ~100 characters around each mention
4. Assign confidence based on clarity:
   - >0.8: Clear recommendation or review
   - 0.5-0.8: Substantive discussion
   - <0.5: Passing mention (exclude these)

Entity types:
- book: Books, novels, textbooks, guides
- movie: Films, documentaries
- tv_show: TV series, web series, limited series

If an entity could be both book and movie (e.g., "Dune"), extract as the type most relevant to context. If unclear, prefer the more recent/popular format.

Return empty entities array if no qualifying entities found.`;

function buildUserPrompt(title: string, markdown: string, url: string): string {
  const truncated =
    markdown.length > MAX_INPUT_CHARS
      ? markdown.slice(0, MAX_INPUT_CHARS) + "\n\n[Content truncated...]"
      : markdown;

  return `Extract entities from this webpage:

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

export async function extractEntities(
  markdown: string,
  title: string,
  url: string,
  llmProvider: LLMProvider
): Promise<ExtractedEntity[]> {
  if (!markdown || markdown.trim().length < 100) {
    return [];
  }

  const result = await llmProvider.generateObject(
    [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: buildUserPrompt(title, markdown, url) },
    ],
    extractionResponseSchema,
    { temperature: 0.1, maxTokens: 2000 }
  );

  const filtered = result.entities.filter(
    (e) => e.confidence >= MIN_CONFIDENCE
  );
  return dedupeEntities(filtered as ExtractedEntity[]);
}
