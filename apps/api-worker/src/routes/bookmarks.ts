import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { createBookmarkSchema } from "@rag-bookmarks/shared";
import type { Env, BookmarkIngestionMessage } from "../types.js";
import { createDb } from "../db/index.js";
import { BookmarkRepository } from "../repositories/bookmarks.js";

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
    const db = createDb(c.env.DATABASE_URL);
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
  const db = createDb(c.env.DATABASE_URL);
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
 * List bookmarks for the current user.
 */
bookmarksRouter.get("/", async (c) => {
  const db = createDb(c.env.DATABASE_URL);
  const bookmarkRepo = new BookmarkRepository(db);

  // TODO: Get userId from auth context
  const userId = TEST_USER_ID;

  try {
    const bookmarks = await bookmarkRepo.listByUser(userId);
    return c.json({
      success: true,
      data: bookmarks,
    });
  } catch (error) {
    console.error("Error listing bookmarks:", error);
    return c.json(
      {
        success: false,
        error: { code: "INTERNAL_ERROR", message: "Failed to list bookmarks" },
      },
      500
    );
  }
});

export { bookmarksRouter };
