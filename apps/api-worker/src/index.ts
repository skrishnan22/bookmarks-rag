/**
 * API Worker
 *
 * HTTP-only API server for the rag-bookmarks application.
 * Queue processing is handled by separate workers:
 * - ingestion-worker: Handles bookmark ingestion
 * - entity-worker: Handles entity extraction and enrichment
 */

import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";

import type { AppContext } from "./types.js";
import { bookmarksRouter } from "./routes/bookmarks.js";
import { searchRouter } from "./routes/search.js";
import { topicsRouter } from "./routes/topics.js";
import { entitiesRouter } from "./routes/entities.js";
import { authRouter } from "./routes/auth.js";

const app = new Hono<AppContext>();

// Middleware
app.use("*", logger());
app.use(
  "*",
  cors({
    origin: (origin, c) => resolveCorsOrigin(origin, c.env.WEB_ORIGIN),
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
      "GET /api/v1/auth/me",
      "POST /api/v1/auth/logout",
      "GET /api/v1/search",
      "GET /api/v1/topics",
      "GET /api/v1/topics/:id",
      "GET /api/v1/topics/:id/bookmarks",
      "PUT /api/v1/topics/:id",
      "POST /api/v1/topics/recluster",
      "GET /api/v1/entities",
      "GET /api/v1/entities/:id",
    ],
  });
});

// Mount routes
app.route("/api/v1/auth", authRouter);
app.route("/api/v1/bookmarks", bookmarksRouter);
app.route("/api/v1/search", searchRouter);
app.route("/api/v1/topics", topicsRouter);
app.route("/api/v1/entities", entitiesRouter);

function resolveCorsOrigin(
  origin: string | undefined,
  configuredWebOrigin: string | undefined
): string | undefined {
  if (!origin) {
    return undefined;
  }

  const allowedOrigins = new Set([
    "http://localhost:3000",
    "http://127.0.0.1:3000",
    "https://wefts.app",
  ]);

  const trimmedConfiguredOrigin = configuredWebOrigin?.trim();
  if (trimmedConfiguredOrigin) {
    allowedOrigins.add(trimmedConfiguredOrigin);
  }

  if (allowedOrigins.has(origin)) {
    return origin;
  }

  return undefined;
}

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

// Export for Cloudflare Workers - HTTP only
export default {
  fetch: app.fetch,
};
