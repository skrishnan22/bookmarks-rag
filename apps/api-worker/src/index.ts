import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import pLimit from "p-limit";

import type {
  Env,
  BookmarkIngestionMessage,
  ClusteringMessage,
  EntityExtractionMessage,
} from "./types.js";
import { bookmarksRouter } from "./routes/bookmarks.js";
import { searchRouter } from "./routes/search.js";
import { topicsRouter } from "./routes/topics.js";
import { entitiesRouter } from "./routes/entities.js";
import { createDb } from "./db/index.js";
import { BookmarkRepository } from "./repositories/bookmarks.js";
import { ChunkRepository } from "./repositories/chunks.js";
import { EntityRepository } from "./repositories/entities.js";
import { chunkMarkdown } from "./services/chunking.js";
import {
  createEmbeddingProvider,
  createLLMProvider,
} from "./providers/index.js";
import { generateEmbeddings } from "./services/embedding.js";
import { fetchAndConvertToMarkdown } from "./services/html-to-markdown.js";
import { generateSummary } from "./services/summary.js";
import { extractEntities } from "./services/entity-extraction.js";
import { EntityEnrichmentService } from "./services/entity-enrichment.js";
import { OpenLibraryProvider } from "./providers/openlibrary.js";
import { TMDBProvider } from "./providers/tmdb.js";
import { normalizeEntityName } from "./utils/normalize.js";

const app = new Hono<{ Bindings: Env }>();

// Middleware
app.use("*", logger());
app.use(
  "*",
  cors({
    origin: (origin) => origin, // TODO: Restrict in production
    credentials: true,
  })
);

// Health check
app.get("/health", (c) => {
  return c.json({ status: "ok", timestamp: new Date().toISOString() });
});

// API info
app.get("/api/v1", (c) => {
  return c.json({
    name: "rag-bookmarks-api",
    version: "0.1.0",
    endpoints: [
      "GET /health",
      "GET /api/v1/bookmarks",
      "POST /api/v1/bookmarks",
      "GET /api/v1/bookmarks/:id",
      "DELETE /api/v1/bookmarks/:id",
      "GET /api/v1/search",
      "GET /api/v1/topics",
      "GET /api/v1/topics/:id",
      "GET /api/v1/topics/:id/bookmarks",
      "PUT /api/v1/topics/:id",
      "POST /api/v1/topics/recluster",
    ],
  });
});

// Mount routes
app.route("/api/v1/bookmarks", bookmarksRouter);
app.route("/api/v1/search", searchRouter);
app.route("/api/v1/topics", topicsRouter);
app.route("/api/v1/entities", entitiesRouter);

// 404 handler
app.notFound((c) => {
  return c.json(
    {
      success: false,
      error: { code: "NOT_FOUND", message: "Route not found" },
    },
    404
  );
});

// Error handler
app.onError((err, c) => {
  console.error("Unhandled error:", err);
  return c.json(
    {
      success: false,
      error: {
        code: "INTERNAL_ERROR",
        message: "An unexpected error occurred",
      },
    },
    500
  );
});

async function handleIngestionMessage(
  message: BookmarkIngestionMessage,
  env: Env,
  bookmarkRepo: BookmarkRepository,
  chunkRepo: ChunkRepository
): Promise<void> {
  const { bookmarkId, url, userId } = message;
  console.log(`Processing bookmark ${bookmarkId}: ${url}`);

  //TODO => skip already completed steps
  try {
    await bookmarkRepo.update({ id: bookmarkId, status: "PROCESSING" });

    const { title, markdown, metadata } = await fetchAndConvertToMarkdown(url);
    console.log(
      `Bookmark ${bookmarkId}: Extracted title "${title}", markdown length: ${markdown.length}`
    );

    const llmProvider = createLLMProvider("openrouter", env.OPENROUTER_API_KEY);
    const summary = await generateSummary(markdown, title, llmProvider);
    console.log(
      `Bookmark ${bookmarkId}: Generated summary (${summary.length} chars)`
    );

    const embeddingProvider = createEmbeddingProvider(
      "jina",
      env.JINA_API_KEY,
      "jina-embeddings-v3",
      "retrieval.passage"
    );

    await bookmarkRepo.update({
      id: bookmarkId,
      title,
      ...(metadata.description && { description: metadata.description }),
      ...(metadata.favicon && { favicon: metadata.favicon }),
      ...(metadata.ogImage && { ogImage: metadata.ogImage }),
      markdown,
      summary,
    });

    const textChunks = chunkMarkdown(markdown);
    const chunksWithBreadcrumbs = textChunks.filter(
      (c) => c.breadcrumbPath
    ).length;
    console.log(
      `Bookmark ${bookmarkId}: Created ${textChunks.length} chunks (${chunksWithBreadcrumbs} with breadcrumbs)`
    );

    await chunkRepo.deleteByBookmarkId(bookmarkId);

    if (textChunks.length > 0) {
      const chunkParams = textChunks.map((chunk) => ({
        bookmarkId,
        content: chunk.content,
        position: chunk.position,
        tokenCount: chunk.tokenCount,
        breadcrumbPath: chunk.breadcrumbPath,
      }));

      const storedChunks = await chunkRepo.createMany(chunkParams);
      console.log(
        `Bookmark ${bookmarkId}: Stored ${storedChunks.length} chunks`
      );

      const chunkContents = storedChunks.map((chunk) => chunk.content);
      console.log(
        `Bookmark ${bookmarkId}: Generating embeddings for ${chunkContents.length} chunks`
      );

      const embeddings = await generateEmbeddings(
        chunkContents,
        embeddingProvider
      );

      // Step 8: Update chunks with embeddings
      for (let i = 0; i < storedChunks.length; i++) {
        const chunk = storedChunks[i];
        const embedding = embeddings[i];
        if (chunk && embedding) {
          await chunkRepo.update({
            id: chunk.id,
            embedding,
          });
        }
      }

      console.log(
        `Bookmark ${bookmarkId}: Stored embeddings for ${embeddings.length} chunks`
      );
      console.log(`Bookmark ${bookmarkId}: Stored bookmark embedding`);
    }

    await bookmarkRepo.update({
      id: bookmarkId,
      status: "DONE",
    });

    await env.ENTITY_QUEUE.send({ bookmarkId, userId });
    console.log(`Bookmark ${bookmarkId}: Enqueued entity extraction`);

    console.log(`Bookmark ${bookmarkId} processed successfully`);
  } catch (error) {
    console.error(`Failed to process bookmark ${bookmarkId}:`, error);
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";

    await bookmarkRepo.update({
      id: bookmarkId,
      status: "FAILED",
      errorMessage,
    });
  }
}

async function handleEntityExtractionMessage(
  message: EntityExtractionMessage,
  env: Env,
  bookmarkRepo: BookmarkRepository,
  entityRepo: EntityRepository
): Promise<void> {
  const { bookmarkId, userId } = message;
  console.log(`Entity extraction for bookmark ${bookmarkId}`);

  const bookmark = await bookmarkRepo.findById(bookmarkId);
  if (!bookmark || !bookmark.markdown) {
    console.log(`Bookmark ${bookmarkId}: No content for entity extraction`);
    return;
  }

  const llmProvider = createLLMProvider("openrouter", env.OPENROUTER_API_KEY);

  const extracted = await extractEntities(
    bookmark.markdown,
    bookmark.title ?? "",
    bookmark.url,
    llmProvider
  );

  if (extracted.length === 0) {
    console.log(`Bookmark ${bookmarkId}: No entities extracted`);
    return;
  }

  console.log(`Bookmark ${bookmarkId}: Extracted ${extracted.length} entities`);

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
        `Bookmark ${bookmarkId}: Linked existing entity "${entity.name}"`
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
        `Bookmark ${bookmarkId}: Created new entity "${entity.name}"`
      );
    }
  }

  console.log(`Bookmark ${bookmarkId}: Entity extraction complete`);
}

// Export for Cloudflare Workers
export default {
  // HTTP request handler
  fetch: app.fetch,

  // Queue consumer handler - routes to appropriate handler based on queue
  async queue(
    batch: MessageBatch<
      BookmarkIngestionMessage | ClusteringMessage | EntityExtractionMessage
    >,
    env: Env
  ): Promise<void> {
    console.log(
      `Processing batch of ${batch.messages.length} messages from queue: ${batch.queue}`
    );

    if (batch.queue === "bookmark-ingestion") {
      const { db, close } = createDb(env.DATABASE_URL);
      const bookmarkRepo = new BookmarkRepository(db);
      const chunkRepo = new ChunkRepository(db);

      const limit = pLimit(2);

      try {
        await Promise.all(
          batch.messages.map((message) =>
            limit(async () => {
              try {
                await handleIngestionMessage(
                  message.body as BookmarkIngestionMessage,
                  env,
                  bookmarkRepo,
                  chunkRepo
                );
                message.ack();
              } catch (error) {
                console.error("Failed to process ingestion message:", error);
                message.retry();
              }
            })
          )
        );
      } finally {
        await close();
      }
    } else if (batch.queue === "entity-extraction") {
      const { db, close } = createDb(env.DATABASE_URL);
      const bookmarkRepo = new BookmarkRepository(db);
      const entityRepo = new EntityRepository(db);

      const limit = pLimit(2);

      try {
        // Extract entities from all bookmarks in batch
        const userIds = new Set<string>();
        await Promise.all(
          batch.messages.map((message) =>
            limit(async () => {
              try {
                await handleEntityExtractionMessage(
                  message.body as EntityExtractionMessage,
                  env,
                  bookmarkRepo,
                  entityRepo
                );
                userIds.add((message.body as EntityExtractionMessage).userId);
                message.ack();
              } catch (error) {
                console.error(
                  "Failed to process entity extraction message:",
                  error
                );
                message.retry();
              }
            })
          )
        );

        // Enrich pending entities for all users in this batch
        const llmProvider = createLLMProvider("openrouter", env.OPENROUTER_API_KEY);
        const openLibrary = new OpenLibraryProvider();
        const tmdb = new TMDBProvider(env.TMDB_API_KEY);
        const enrichmentService = new EntityEnrichmentService(
          entityRepo,
          openLibrary,
          tmdb,
          llmProvider
        );

        for (const userId of userIds) {
          try {
            await enrichmentService.enrichPendingEntities(userId);
          } catch (error) {
            console.error(`Failed to enrich entities for user ${userId}:`, error);
          }
        }
      } finally {
        await close();
      }
    } else {
      console.error(`Unknown queue: ${batch.queue}`);
      for (const message of batch.messages) {
        message.ack();
      }
    }
  },
};
