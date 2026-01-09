import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import type { Env } from "../types.js";
import { createDb } from "../db/index.js";
import { SearchRepository } from "../repositories/search.js";
import { BookmarkRepository } from "../repositories/bookmarks.js";
import {
  createEmbeddingProvider,
  createRerankerProvider,
} from "../providers/index.js";
import { search } from "../services/search.js";

const TEST_USER_ID = "00000000-0000-0000-0000-000000000001";

const searchQuerySchema = z.object({
  q: z.string().min(1).max(500),
  limit: z.coerce.number().min(1).max(50).optional().default(5),
});

const searchRouter = new Hono<{ Bindings: Env }>();

/**
 * GET /api/v1/search?q=stripe+payment+integration
 *
 * Search bookmarks using hybrid vector + BM25 search with reranking.
 *
 * Query params:
 *   q: Search query (required, 1-500 chars)
 *   limit: Max results to return (optional, 1-20, default 5)
 *
 * Response:
 *   200: { success: true, data: { query, results, totalResults } }
 *   400: Validation error
 *   500: Server error
 */
searchRouter.get("/", zValidator("query", searchQuerySchema), async (c) => {
  const { q, limit } = c.req.valid("query");
  const { db } = createDb(c.env.DATABASE_URL);
  const searchRepo = new SearchRepository(db);
  const bookmarkRepo = new BookmarkRepository(db);

  const userId = TEST_USER_ID;

  try {
    const embeddingProvider = createEmbeddingProvider(
      "jina",
      c.env.JINA_API_KEY,
      "jina-embeddings-v3",
      "retrieval.query"
    );
    const rerankerProvider = createRerankerProvider("jina", c.env.JINA_API_KEY);

    const results = await search(
      { query: q, userId, topN: limit },
      embeddingProvider,
      rerankerProvider,
      searchRepo,
      bookmarkRepo
    );

    return c.json({
      success: true,
      data: {
        query: q,
        results: results.map((r) => ({
          bookmarkId: r.bookmarkId,
          title: r.bookmarkTitle,
          url: r.bookmarkUrl,
          snippet: r.chunkContent,
          breadcrumb: r.breadcrumbPath,
          score: r.score,
          favicon: r.bookmarkFavicon,
          ogImage: r.bookmarkOgImage,
          description: r.bookmarkDescription,
        })),
        totalResults: results.length,
      },
    });
  } catch (error) {
    console.error("Error searching bookmarks:", error);
    return c.json(
      {
        success: false,
        error: {
          code: "INTERNAL_ERROR",
          message: "Failed to search bookmarks",
        },
      },
      500
    );
  }
});

export { searchRouter };
