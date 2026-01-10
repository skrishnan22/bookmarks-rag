import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import pLimit from "p-limit";

import type {
  Env,
  BookmarkIngestionMessage,
  ClusteringMessage,
} from "./types.js";
import { bookmarksRouter } from "./routes/bookmarks.js";
import { searchRouter } from "./routes/search.js";
import { topicsRouter } from "./routes/topics.js";
import { createDb } from "./db/index.js";
import { BookmarkRepository } from "./repositories/bookmarks.js";
import { ChunkRepository } from "./repositories/chunks.js";
import { TopicRepository } from "./repositories/topics.js";
import { chunkMarkdown } from "./services/chunking.js";
import {
  createEmbeddingProvider,
  createLLMProvider,
} from "./providers/index.js";
import { generateEmbedding, generateEmbeddings } from "./services/embedding.js";
import { fetchAndConvertToMarkdown } from "./services/html-to-markdown.js";
import { generateSummary } from "./services/summary.js";
import { users } from "./db/schema.js";
import type { Database } from "./db/index.js";

async function getAllUserIds(db: Database): Promise<string[]> {
  const result = await db.select({ id: users.id }).from(users);
  return result.map((r) => r.id);
}

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
  chunkRepo: ChunkRepository,
  topicRepo: TopicRepository
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

// Export for Cloudflare Workers
export default {
  // HTTP request handler
  fetch: app.fetch,

  // Queue consumer handler - routes to appropriate handler based on queue
  async queue(
    batch: MessageBatch<BookmarkIngestionMessage | ClusteringMessage>,
    env: Env
  ): Promise<void> {
    console.log(
      `Processing batch of ${batch.messages.length} messages from queue: ${batch.queue}`
    );

    if (batch.queue === "bookmark-ingestion") {
      const { db, close } = createDb(env.DATABASE_URL);
      const bookmarkRepo = new BookmarkRepository(db);
      const chunkRepo = new ChunkRepository(db);
      const topicRepo = new TopicRepository(db);

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
                  chunkRepo,
                  topicRepo
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
    } else {
      console.error(`Unknown queue: ${batch.queue}`);
      for (const message of batch.messages) {
        message.ack();
      }
    }
  },
};
