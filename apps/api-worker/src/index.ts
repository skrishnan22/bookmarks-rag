import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import pLimit from "p-limit";

import type { Env, BookmarkIngestionMessage } from "./types.js";
import { bookmarksRouter } from "./routes/bookmarks.js";
import { searchRouter } from "./routes/search.js";
import { createDb } from "./db/index.js";
import { BookmarkRepository } from "./repositories/bookmarks.js";
import { ChunkRepository } from "./repositories/chunks.js";
import { chunkMarkdown } from "./services/chunking.js";
import {
  createEmbeddingProvider,
  createLLMProvider,
} from "./providers/index.js";
import { generateEmbeddings } from "./services/embedding.js";
import { fetchAndConvertToMarkdown } from "./services/html-to-markdown.js";
import { generateSummary } from "./services/summary.js";

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
    ],
  });
});

// Mount routes
app.route("/api/v1/bookmarks", bookmarksRouter);
app.route("/api/v1/search", searchRouter);

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

/**
 * Queue consumer handler
 * Processes bookmark ingestion messages from the queue
 */
async function handleQueueMessage(
  message: BookmarkIngestionMessage,
  env: Env
): Promise<void> {
  const { bookmarkId, url } = message;
  console.log(`Processing bookmark ${bookmarkId}: ${url}`);

  const db = createDb(env.DATABASE_URL);
  const bookmarkRepo = new BookmarkRepository(db);
  const chunkRepo = new ChunkRepository(db);

  try {
    // Update status to processing
    await bookmarkRepo.update({ id: bookmarkId, status: "PROCESSING" });

    // Step 1: Fetch URL and convert to markdown
    const { title, markdown } = await fetchAndConvertToMarkdown(url);
    console.log(
      `Bookmark ${bookmarkId}: Extracted title "${title}", markdown length: ${markdown.length}`
    );

    // Step 2: Generate summary
    const llmProvider = createLLMProvider("openrouter", env.OPENROUTER_API_KEY);
    const summary = await generateSummary(markdown, title, llmProvider);
    console.log(
      `Bookmark ${bookmarkId}: Generated summary (${summary.length} chars)`
    );

    // Step 3: Update bookmark with extracted content and summary
    await bookmarkRepo.update({
      id: bookmarkId,
      title,
      markdown,
      summary,
    });

    // Step 4: Chunk the markdown
    const textChunks = chunkMarkdown(markdown);
    const chunksWithBreadcrumbs = textChunks.filter(
      (c) => c.breadcrumbPath
    ).length;
    console.log(
      `Bookmark ${bookmarkId}: Created ${textChunks.length} chunks (${chunksWithBreadcrumbs} with breadcrumbs)`
    );

    // Step 5: Delete existing chunks (in case of re-processing)
    await chunkRepo.deleteByBookmarkId(bookmarkId);

    // Step 6: Store chunks in database
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

      const embeddingProvider = createEmbeddingProvider(
        "jina",
        env.JINA_API_KEY
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
    }

    // Mark as done
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

    await bookmarkRepo.update({
      id: bookmarkId,
      status: "FAILED",
      errorMessage,
    });

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

  // Queue consumer handler
  async queue(
    batch: MessageBatch<BookmarkIngestionMessage>,
    env: Env
  ): Promise<void> {
    console.log(`Processing batch of ${batch.messages.length} messages`);

    const limit = pLimit(5);

    await Promise.all(
      batch.messages.map((message) =>
        limit(async () => {
          try {
            await handleQueueMessage(message.body, env);
            message.ack();
          } catch (error) {
            console.error("Failed to process message:", error);
            message.retry();
          }
        })
      )
    );
  },
};
