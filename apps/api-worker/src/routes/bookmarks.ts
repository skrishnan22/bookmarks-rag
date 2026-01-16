import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import {
  createBookmarkSchema,
  createDb,
  BookmarkRepository,
} from "@rag-bookmarks/shared";
import type { Env, BookmarkIngestionMessage } from "../types.js";

const listBookmarksSchema = z.object({
  limit: z.coerce.number().min(1).max(100).optional().default(20),
  offset: z.coerce.number().min(0).optional().default(0),
});

// Test user ID for development (until auth is implemented)
const TEST_USER_ID = "00000000-0000-0000-0000-000000000001";

const bookmarksRouter = new Hono<{ Bindings: Env }>();

/**
 * POST /api/v1/bookmarks
 *
 * Create a new bookmark and queue it for processing.
 *
 * Request body:
 *   { url: string }
 *
 * Response:
 *   201: { success: true, data: { id, url, status } }
 *   400: Validation error
 *   409: Bookmark already exists for this URL
 *   500: Server error
 */
bookmarksRouter.post(
  "/",
  zValidator("json", createBookmarkSchema),
  async (c) => {
    const { url } = c.req.valid("json");
    const { db } = createDb(c.env.DATABASE_URL);
    const bookmarkRepo = new BookmarkRepository(db);

    // TODO: Get userId from auth context when implemented
    const userId = TEST_USER_ID;

    try {
      const existing = await bookmarkRepo.findByUserAndUrl(userId, url);
      if (existing) {
        return c.json(
          {
            success: false,
            error: {
              code: "BOOKMARK_EXISTS",
              message: "Bookmark already exists for this URL",
              bookmarkId: existing.id,
            },
          },
          409
        );
      }

      const bookmark = await bookmarkRepo.create({ userId, url });

      const message: BookmarkIngestionMessage = {
        bookmarkId: bookmark.id,
        url: bookmark.url,
        userId: bookmark.userId,
      };
      await c.env.INGESTION_QUEUE.send(message);

      console.log(`Bookmark ${bookmark.id} created and queued for processing`);

      return c.json(
        {
          success: true,
          data: {
            id: bookmark.id,
            url: bookmark.url,
            status: bookmark.status,
          },
        },
        202
      );
    } catch (error) {
      console.error("Error creating bookmark:", error);
      return c.json(
        {
          success: false,
          error: {
            code: "INTERNAL_ERROR",
            message: "Failed to create bookmark",
          },
        },
        500
      );
    }
  }
);

/**
 * GET /api/v1/bookmarks/:id
 *
 * Get a bookmark by ID.
 */
bookmarksRouter.get("/:id", async (c) => {
  const { id } = c.req.param();
  const { db } = createDb(c.env.DATABASE_URL);
  const bookmarkRepo = new BookmarkRepository(db);

  try {
    const bookmark = await bookmarkRepo.findById(id);
    if (!bookmark) {
      return c.json(
        {
          success: false,
          error: { code: "NOT_FOUND", message: "Bookmark not found" },
        },
        404
      );
    }

    // TODO: Check bookmark belongs to authenticated user

    return c.json({
      success: true,
      data: bookmark,
    });
  } catch (error) {
    console.error("Error fetching bookmark:", error);
    return c.json(
      {
        success: false,
        error: { code: "INTERNAL_ERROR", message: "Failed to fetch bookmark" },
      },
      500
    );
  }
});

/**
 * GET /api/v1/bookmarks
 *
 * List bookmarks for the current user with pagination.
 *
 * Query params:
 *   limit: Max results to return (optional, 1-100, default 20)
 *   offset: Number of results to skip (optional, default 0)
 */
bookmarksRouter.get(
  "/",
  zValidator("query", listBookmarksSchema),
  async (c) => {
    const { limit, offset } = c.req.valid("query");
    const { db } = createDb(c.env.DATABASE_URL);
    const bookmarkRepo = new BookmarkRepository(db);

    // TODO: Get userId from auth context
    const userId = TEST_USER_ID;

    try {
      const bookmarks = await bookmarkRepo.listByUser(userId, limit, offset);
      return c.json({
        success: true,
        data: bookmarks,
      });
    } catch (error) {
      console.error("Error listing bookmarks:", error);
      return c.json(
        {
          success: false,
          error: {
            code: "INTERNAL_ERROR",
            message: "Failed to list bookmarks",
          },
        },
        500
      );
    }
  }
);

/**
 * DELETE /api/v1/bookmarks/:id
 *
 * Delete a bookmark by ID.
 * Cascade deletes will remove associated chunks, entity_bookmarks, and bookmark_topics.
 *
 * Response:
 *   200: { success: true }
 *   404: Bookmark not found or doesn't belong to user
 *   500: Server error
 */
bookmarksRouter.delete("/:id", async (c) => {
  const { id } = c.req.param();
  const { db } = createDb(c.env.DATABASE_URL);
  const bookmarkRepo = new BookmarkRepository(db);

  // TODO: Get userId from auth context when implemented
  const userId = TEST_USER_ID;

  try {
    const deleted = await bookmarkRepo.delete(id, userId);

    if (!deleted) {
      return c.json(
        {
          success: false,
          error: { code: "NOT_FOUND", message: "Bookmark not found" },
        },
        404
      );
    }

    console.log(`Bookmark ${id} deleted`);

    return c.json({ success: true });
  } catch (error) {
    console.error("Error deleting bookmark:", error);
    return c.json(
      {
        success: false,
        error: { code: "INTERNAL_ERROR", message: "Failed to delete bookmark" },
      },
      500
    );
  }
});

export { bookmarksRouter };
