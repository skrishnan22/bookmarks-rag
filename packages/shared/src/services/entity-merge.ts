import { and, eq } from "drizzle-orm";
import type { Database } from "../db/index.js";
import {
  entities,
  entityBookmarks,
  type ImageExtractedEntity,
  type ExtractionHints,
} from "../db/schema.js";
import { normalizeEntityName } from "../utils/normalize.js";

const MIN_IMAGE_ENTITY_CONFIDENCE = 0.5;

export interface MergeImageEntitiesInput {
  db: Database;
  userId: string;
  bookmarkId: string;
  imageId: string;
  extractedEntities: ImageExtractedEntity[];
  contextSnippet?: string | undefined;
}

export async function mergeImageEntities(
  input: MergeImageEntitiesInput
): Promise<{ created: number; linked: number }> {
  const { db, userId, bookmarkId, imageId, extractedEntities, contextSnippet } =
    input;

  let created = 0;
  let linked = 0;

  if (extractedEntities.length === 0) {
    return { created, linked };
  }

  const seen = new Set<string>();

  for (const entity of extractedEntities) {
    if (entity.confidence < MIN_IMAGE_ENTITY_CONFIDENCE) {
      continue;
    }

    const normalizedName = normalizeEntityName(entity.name);
    if (!normalizedName) {
      continue;
    }

    const dedupeKey = `${entity.type}:${normalizedName}`;
    if (seen.has(dedupeKey)) {
      continue;
    }
    seen.add(dedupeKey);

    const existing = await db
      .select()
      .from(entities)
      .where(
        and(
          eq(entities.userId, userId),
          eq(entities.type, entity.type),
          eq(entities.normalizedName, normalizedName)
        )
      )
      .limit(1);

    let entityId = existing[0]?.id;

    if (!entityId) {
      const inserted = await db
        .insert(entities)
        .values({
          userId,
          type: entity.type,
          name: entity.name,
          normalizedName,
          status: "PENDING",
        })
        .returning({ id: entities.id });

      entityId = inserted[0]?.id;
      if (!entityId) {
        continue;
      }
      created += 1;
    }

    const existingLink = await db
      .select({ entityId: entityBookmarks.entityId })
      .from(entityBookmarks)
      .where(
        and(
          eq(entityBookmarks.entityId, entityId),
          eq(entityBookmarks.bookmarkId, bookmarkId)
        )
      )
      .limit(1);

    if (existingLink.length > 0) {
      continue;
    }

    const hints: ExtractionHints = {
      year: entity.hints?.year ?? null,
      author: entity.hints?.author ?? null,
      director: entity.hints?.director ?? null,
      language: null,
    };

    const hasHints = Object.values(hints).some((value) => value !== null);

    await db.insert(entityBookmarks).values({
      entityId,
      bookmarkId,
      confidence: entity.confidence,
      source: "image",
      sourceImageId: imageId,
      contextSnippet,
      extractionHints: hasHints ? hints : undefined,
    });

    linked += 1;
  }

  return { created, linked };
}
