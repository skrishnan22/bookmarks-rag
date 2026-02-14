import pLimit from "p-limit";

import type {
  Env,
  EntityQueueMessage,
  EntityExtractionMessage,
  EntityEnrichmentMessage,
  ImageEntityExtractionMessage,
} from "./types.js";
import type { Database } from "@rag-bookmarks/shared";

import {
  createDb,
  BookmarkRepository,
  EntityRepository,
  ContentImageRepository,
  createLLMProvider,
  extractSummaryAndEntities,
  extractEntitiesFromImage,
  mergeImageEntities,
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

  if (bookmark.entitiesExtracted) {
    console.log(
      `[extraction] Bookmark ${bookmarkId}: Already extracted, skipping`
    );
    return false;
  }

  const llmProvider = createLLMProvider("openrouter", env.OPENROUTER_API_KEY);

  const { summary, entities: extracted } = await extractSummaryAndEntities(
    bookmark.markdown,
    bookmark.title ?? "",
    bookmark.url,
    llmProvider
  );

  // Update bookmark with summary (even if no entities found)
  if (summary) {
    await bookmarkRepo.update({ id: bookmarkId, summary });
    console.log(`[extraction] Bookmark ${bookmarkId}: Summary updated`);
  }

  if (extracted.length === 0) {
    console.log(`[extraction] Bookmark ${bookmarkId}: No entities found`);
    // Mark as extracted even if no entities found to avoid re-processing
    await bookmarkRepo.setEntitiesExtracted(bookmarkId, true);
    return false;
  }

  console.log(
    `[extraction] Bookmark ${bookmarkId}: Found ${extracted.length} entities`
  );

  let createdNew = false;
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
        extractionHints: entity.hints ?? undefined,
      });
      console.log(
        `[extraction] Bookmark ${bookmarkId}: Linked existing "${entity.name}"`
      );
    } else {
      createdNew = true;
      const newEntity = await entityRepo.create({
        userId,
        type: entity.type,
        name: entity.name,
        normalizedName,
        status: "PENDING",
      });

      await entityRepo.linkToBookmark({
        entityId: newEntity.id,
        bookmarkId,
        contextSnippet: entity.contextSnippet,
        confidence: entity.confidence,
        extractionHints: entity.hints ?? undefined,
      });
      console.log(
        `[extraction] Bookmark ${bookmarkId}: Created "${entity.name}"`
      );
    }
  }

  await bookmarkRepo.setEntitiesExtracted(bookmarkId, true);

  console.log(`[extraction] Bookmark ${bookmarkId}: Complete`);
  return createdNew;
}

async function handleEntityEnrichment(
  message: EntityEnrichmentMessage,
  env: Env,
  entityRepo: EntityRepository
): Promise<void> {
  const { userId, bookmarkId } = message;
  console.log(`[enrichment] Bookmark ${bookmarkId}: Starting`);

  const llmProvider = createLLMProvider("openrouter", env.OPENROUTER_API_KEY);
  const openLibrary = new OpenLibraryProvider();
  const tmdb = new TMDBProvider(env.TMDB_API_KEY);

  const enrichmentService = new EntityEnrichmentService(
    entityRepo,
    openLibrary,
    tmdb,
    llmProvider
  );

  await enrichmentService.enrichEntitiesForBookmark(userId, bookmarkId);
  console.log(`[enrichment] Bookmark ${bookmarkId}: Complete`);
}

// Image entity extraction handler
async function handleImageEntityExtraction(
  message: ImageEntityExtractionMessage,
  env: Env,
  contentImageRepo: ContentImageRepository,
  db: Database
): Promise<boolean> {
  const { imageId, bookmarkId, userId } = message;
  const hasApiKey = Boolean(env.OPENROUTER_API_KEY);

  if (!hasApiKey) {
    await contentImageRepo.update({
      id: imageId,
      status: "FAILED",
      errorMessage: "Missing OPENROUTER_API_KEY",
    });
    console.warn(`[image-extraction] Image ${imageId}: Missing API key`);
    return false;
  }
  console.log(`[image-extraction] Image ${imageId}: Starting`);

  const image = await contentImageRepo.findById(imageId);
  if (!image) {
    console.log(`[image-extraction] Image ${imageId}: Not found, skipping`);
    return false;
  }

  if (image.status === "COMPLETED" || image.status === "SKIPPED") {
    console.log(
      `[image-extraction] Image ${imageId}: Status is ${image.status}, skipping`
    );
    return false;
  }

  if (image.status === "PROCESSING") {
    console.log(`[image-extraction] Image ${imageId}: Already processing`);
    return false;
  }

  await contentImageRepo.update({
    id: imageId,
    status: "PROCESSING",
  });

  try {
    const extracted = await extractEntitiesFromImage(
      image.url,
      {
        nearbyText: image.nearbyText ?? undefined,
        altText: image.altText ?? undefined,
      },
      env.OPENROUTER_API_KEY!
    );

    const contextSnippet = image.nearbyText ?? image.altText ?? undefined;

    const mergeResult = await mergeImageEntities({
      db,
      userId,
      bookmarkId,
      imageId,
      extractedEntities: extracted.entities,
      contextSnippet,
    });

    await contentImageRepo.update({
      id: imageId,
      status: "COMPLETED",
      processedAt: new Date(),
      extractedEntities: extracted,
    });

    if (mergeResult.created > 0) {
      await env.ENTITY_QUEUE.send({
        type: "entity-enrichment",
        userId,
        bookmarkId,
      });
    }

    console.log(
      `[image-extraction] Image ${imageId}: ` +
        `Extracted ${extracted.entities.length} entities, ` +
        `created ${mergeResult.created}, linked ${mergeResult.linked}`
    );

    return mergeResult.created > 0;
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";

    await contentImageRepo.update({
      id: imageId,
      status: "FAILED",
      errorMessage,
    });

    console.error(`[image-extraction] Image ${imageId}: Failed`, error);
    throw error;
  }
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
    const contentImageRepo = new ContentImageRepository(db);

    const limit = pLimit(2); //TODO=>move this to worker config

    try {
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
                  await env.ENTITY_QUEUE.send({
                    type: "entity-enrichment",
                    userId: msg.userId,
                    bookmarkId: msg.bookmarkId,
                  });
                  console.log(
                    `Queued enrichment for bookmark ${msg.bookmarkId}`
                  );
                }
              } else if (msg.type === "entity-enrichment") {
                await handleEntityEnrichment(msg, env, entityRepo);
              } else if (msg.type === "image-entity-extraction") {
                await handleImageEntityExtraction(
                  msg,
                  env,
                  contentImageRepo,
                  db
                );
              }

              message.ack();
            } catch (error) {
              console.error(`Failed to process ${msg.type} message:`, error);
              message.retry();
            }
          })
        )
      );
    } finally {
      await close();
    }
  },
};
