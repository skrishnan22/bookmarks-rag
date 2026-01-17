/**
 * Entity Worker
 *
 * Consumes entity queue and processes two message types:
 * 1. entity-extraction: Extracts entities from bookmark markdown, creates/links them
 * 2. entity-enrichment: Enriches pending entities for a user with external metadata
 */

import pLimit from "p-limit";

import type {
  Env,
  EntityQueueMessage,
  EntityExtractionMessage,
  EntityEnrichmentMessage,
} from "./types.js";
import {
  createDb,
  BookmarkRepository,
  EntityRepository,
  createLLMProvider,
  extractEntities,
  normalizeEntityName,
  EntityEnrichmentService,
  OpenLibraryProvider,
  TMDBProvider,
} from "@rag-bookmarks/shared";

async function handleEntityExtraction(
  message: EntityExtractionMessage,
  env: Env,
  bookmarkRepo: BookmarkRepository,
  entityRepo: EntityRepository
): Promise<boolean> {
  const { bookmarkId, userId } = message;
  console.log(`[extraction] Bookmark ${bookmarkId}: Starting`);

  const bookmark = await bookmarkRepo.findById(bookmarkId);
  if (!bookmark || !bookmark.markdown) {
    console.log(`[extraction] Bookmark ${bookmarkId}: No content, skipping`);
    return false;
  }

  // Skip if entities already extracted for this bookmark
  if (bookmark.entitiesExtracted) {
    console.log(
      `[extraction] Bookmark ${bookmarkId}: Already extracted, skipping`
    );
    return false;
  }

  const llmProvider = createLLMProvider("openrouter", env.OPENROUTER_API_KEY);

  const extracted = await extractEntities(
    bookmark.markdown,
    bookmark.title ?? "",
    bookmark.url,
    llmProvider
  );

  if (extracted.length === 0) {
    console.log(`[extraction] Bookmark ${bookmarkId}: No entities found`);
    // Mark as extracted even if no entities found (to avoid re-processing)
    await bookmarkRepo.setEntitiesExtracted(bookmarkId, true);
    return false;
  }

  console.log(
    `[extraction] Bookmark ${bookmarkId}: Found ${extracted.length} entities`
  );

  let createdNewEntities = false;

  for (const entity of extracted) {
    const normalizedName = normalizeEntityName(entity.name);

    const existing = await entityRepo.findByNormalizedName(
      userId,
      entity.type,
      normalizedName
    );

    if (existing) {
      await entityRepo.linkToBookmark({
        entityId: existing.id,
        bookmarkId,
        contextSnippet: entity.contextSnippet,
        confidence: entity.confidence,
      });
      console.log(
        `[extraction] Bookmark ${bookmarkId}: Linked existing "${entity.name}"`
      );
    } else {
      const newEntity = await entityRepo.create({
        userId,
        type: entity.type,
        name: entity.name,
        normalizedName,
        status: "pending",
      });

      await entityRepo.linkToBookmark({
        entityId: newEntity.id,
        bookmarkId,
        contextSnippet: entity.contextSnippet,
        confidence: entity.confidence,
      });
      console.log(
        `[extraction] Bookmark ${bookmarkId}: Created "${entity.name}"`
      );
      createdNewEntities = true;
    }
  }

  // Mark extraction complete AFTER all entities are stored
  await bookmarkRepo.setEntitiesExtracted(bookmarkId, true);

  console.log(`[extraction] Bookmark ${bookmarkId}: Complete`);
  return createdNewEntities;
}

async function handleEntityEnrichment(
  message: EntityEnrichmentMessage,
  env: Env,
  entityRepo: EntityRepository
): Promise<void> {
  const { userId } = message;
  console.log(`[enrichment] User ${userId}: Starting`);

  const llmProvider = createLLMProvider("openrouter", env.OPENROUTER_API_KEY);
  const openLibrary = new OpenLibraryProvider();
  const tmdb = new TMDBProvider(env.TMDB_API_KEY);

  const enrichmentService = new EntityEnrichmentService(
    entityRepo,
    openLibrary,
    tmdb,
    llmProvider
  );

  await enrichmentService.enrichPendingEntities(userId);
  console.log(`[enrichment] User ${userId}: Complete`);
}

export default {
  async queue(
    batch: MessageBatch<EntityQueueMessage>,
    env: Env
  ): Promise<void> {
    console.log(`Processing batch of ${batch.messages.length} messages`);

    const { db, close } = createDb(env.DATABASE_URL);
    const bookmarkRepo = new BookmarkRepository(db);
    const entityRepo = new EntityRepository(db);

    const limit = pLimit(2);

    try {
      // Track users who need enrichment (from extraction messages that created new entities)
      const usersNeedingEnrichment = new Set<string>();

      await Promise.all(
        batch.messages.map((message) =>
          limit(async () => {
            const msg = message.body;

            try {
              if (msg.type === "entity-extraction") {
                const createdNew = await handleEntityExtraction(
                  msg,
                  env,
                  bookmarkRepo,
                  entityRepo
                );
                if (createdNew) {
                  usersNeedingEnrichment.add(msg.userId);
                }
              } else if (msg.type === "entity-enrichment") {
                await handleEntityEnrichment(msg, env, entityRepo);
              }

              message.ack();
            } catch (error) {
              console.error(`Failed to process ${msg.type} message:`, error);
              message.retry();
            }
          })
        )
      );

      // Queue enrichment for users who had new entities created
      for (const userId of usersNeedingEnrichment) {
        await env.ENTITY_QUEUE.send({
          type: "entity-enrichment",
          userId,
        });
        console.log(`Queued enrichment for user ${userId}`);
      }
    } finally {
      await close();
    }
  },
};
