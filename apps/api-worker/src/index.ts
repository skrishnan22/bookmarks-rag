import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";

import type { Env, BookmarkIngestionMessage } from "./types.js";
import { bookmarksRouter } from "./routes/bookmarks.js";
import { createDb } from "./db/index.js";
import { BookmarkRepository } from "./repositories/bookmarks.js";

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

  try {
    // Update status to processing
    await bookmarkRepo.update({ id: bookmarkId, status: "PROCESSING" });

    // Call Markdowner to convert URL to markdown
    const markdownerUrl = env.MARKDOWNER_URL || "http://localhost:8787";
    const response = await fetch(markdownerUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url }),
    });

    if (!response.ok) {
      throw new Error(
        `Markdowner failed: ${response.status} ${response.statusText}`
      );
    }

    const result = (await response.json()) as {
      content?: string;
      title?: string;
    };
    const markdown = result.content || "";
    const title = result.title || url;

    // Update bookmark with extracted content
    await bookmarkRepo.update({
      id: bookmarkId,
      title,
      markdown,
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

  // Queue consumer handler
  async queue(
    batch: MessageBatch<BookmarkIngestionMessage>,
    env: Env
  ): Promise<void> {
    console.log(`Processing batch of ${batch.messages.length} messages`);

    for (const message of batch.messages) {
      try {
        await handleQueueMessage(message.body, env);
        message.ack();
      } catch (error) {
        console.error("Failed to process message:", error);
        message.retry();
      }
    }
  },
};
