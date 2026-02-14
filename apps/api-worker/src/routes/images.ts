import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import {
  createAuthedDb,
  BookmarkRepository,
  ContentImageRepository,
} from "@rag-bookmarks/shared";
import type { AppContext, ImageEntityExtractionMessage } from "../types.js";

const extractAllSchema = z.object({
  minScore: z.coerce.number().min(0).max(1).optional(),
});

const imagesRouter = new Hono<AppContext>();

/**
 * GET /api/v1/bookmarks/:bookmarkId/images
 *
 * List all images for a bookmark with their status and heuristic scores.
 */
imagesRouter.get("/", async (c) => {
  const bookmarkId = c.req.param("bookmarkId");
  if (!bookmarkId) {
    return c.json(
      {
        success: false,
        error: { code: "BAD_REQUEST", message: "Missing bookmarkId parameter" },
      },
      400
    );
  }

  const { userId } = c.get("auth");
  const { db } = await createAuthedDb(c.env.DATABASE_URL, userId);
  const bookmarkRepo = new BookmarkRepository(db);
  const contentImageRepo = new ContentImageRepository(db);

  try {
    // Verify bookmark exists and belongs to user
    const bookmark = await bookmarkRepo.findByIdForUser(userId, bookmarkId);
    if (!bookmark) {
      return c.json(
        {
          success: false,
          error: { code: "NOT_FOUND", message: "Bookmark not found" },
        },
        404
      );
    }

    const images = await contentImageRepo.findByBookmarkId(bookmarkId);

    return c.json({
      success: true,
      data: {
        bookmarkId,
        images: images.map((img) => ({
          id: img.id,
          url: img.url,
          altText: img.altText,
          position: img.position,
          status: img.status,
          heuristicScore: img.heuristicScore,
          estimatedType: img.estimatedType,
          extractedEntities: img.extractedEntities,
          processedAt: img.processedAt,
          errorMessage: img.errorMessage,
        })),
        total: images.length,
      },
    });
  } catch (error) {
    console.error("Error listing images:", error);
    return c.json(
      {
        success: false,
        error: { code: "INTERNAL_ERROR", message: "Failed to list images" },
      },
      500
    );
  }
});

/**
 * POST /api/v1/bookmarks/:bookmarkId/images/:imageId/extract
 *
 * Queue a specific image for entity extraction.
 */
imagesRouter.post("/:imageId/extract", async (c) => {
  const bookmarkId = c.req.param("bookmarkId");
  const imageId = c.req.param("imageId");

  if (!bookmarkId || !imageId) {
    return c.json(
      {
        success: false,
        error: { code: "BAD_REQUEST", message: "Missing required parameters" },
      },
      400
    );
  }

  const { userId } = c.get("auth");
  const { db } = await createAuthedDb(c.env.DATABASE_URL, userId);
  const bookmarkRepo = new BookmarkRepository(db);
  const contentImageRepo = new ContentImageRepository(db);

  try {
    // Verify bookmark exists
    const bookmark = await bookmarkRepo.findByIdForUser(userId, bookmarkId);
    if (!bookmark) {
      return c.json(
        {
          success: false,
          error: { code: "NOT_FOUND", message: "Bookmark not found" },
        },
        404
      );
    }

    // Verify image exists and belongs to bookmark
    const image = await contentImageRepo.findById(imageId);
    if (!image || image.bookmarkId !== bookmarkId) {
      return c.json(
        {
          success: false,
          error: { code: "NOT_FOUND", message: "Image not found" },
        },
        404
      );
    }

    // Check if already processed or processing
    if (image.status === "COMPLETED") {
      return c.json(
        {
          success: false,
          error: {
            code: "ALREADY_PROCESSED",
            message: "Image has already been processed",
          },
        },
        409
      );
    }

    if (image.status === "PROCESSING" || image.status === "QUEUED") {
      return c.json(
        {
          success: false,
          error: {
            code: "ALREADY_QUEUED",
            message: "Image is already queued for processing",
          },
        },
        409
      );
    }

    // Update status to QUEUED
    await contentImageRepo.updateStatus(imageId, "QUEUED");

    // Queue the image for extraction
    const message: ImageEntityExtractionMessage = {
      type: "image-entity-extraction",
      imageId,
      bookmarkId,
      userId,
    };
    await c.env.ENTITY_QUEUE.send(message);

    console.log(`Image ${imageId} queued for entity extraction`);

    return c.json({
      success: true,
      data: { imageId, status: "QUEUED" },
    });
  } catch (error) {
    console.error("Error queueing image extraction:", error);
    return c.json(
      {
        success: false,
        error: {
          code: "INTERNAL_ERROR",
          message: "Failed to queue image extraction",
        },
      },
      500
    );
  }
});

/**
 * POST /api/v1/bookmarks/:bookmarkId/images/extract-all
 *
 * Queue all pending images for a bookmark for entity extraction.
 * Optionally filter by minimum heuristic score.
 */
imagesRouter.post(
  "/extract-all",
  zValidator("json", extractAllSchema),
  async (c) => {
    const bookmarkId = c.req.param("bookmarkId");
    if (!bookmarkId) {
      return c.json(
        {
          success: false,
          error: {
            code: "BAD_REQUEST",
            message: "Missing bookmarkId parameter",
          },
        },
        400
      );
    }

    const { minScore } = c.req.valid("json");
    const { userId } = c.get("auth");
    const { db } = await createAuthedDb(c.env.DATABASE_URL, userId);
    const bookmarkRepo = new BookmarkRepository(db);
    const contentImageRepo = new ContentImageRepository(db);

    try {
      // Verify bookmark exists
      const bookmark = await bookmarkRepo.findByIdForUser(userId, bookmarkId);
      if (!bookmark) {
        return c.json(
          {
            success: false,
            error: { code: "NOT_FOUND", message: "Bookmark not found" },
          },
          404
        );
      }

      // Get pending images, optionally filtered by score
      let images = await contentImageRepo.findPendingByBookmarkId(bookmarkId);

      if (minScore !== undefined) {
        images = images.filter(
          (img) => img.heuristicScore !== null && img.heuristicScore >= minScore
        );
      }

      if (images.length === 0) {
        return c.json({
          success: true,
          data: { queued: 0, message: "No pending images to process" },
        });
      }

      // Update all to QUEUED status
      const imageIds = images.map((img) => img.id);
      await contentImageRepo.updateStatusBulk(imageIds, "QUEUED");

      // Queue each image
      await Promise.all(
        images.map((img) => {
          const message: ImageEntityExtractionMessage = {
            type: "image-entity-extraction",
            imageId: img.id,
            bookmarkId,
            userId,
          };
          return c.env.ENTITY_QUEUE.send(message);
        })
      );

      console.log(
        `Queued ${images.length} images for extraction from bookmark ${bookmarkId}`
      );

      return c.json({
        success: true,
        data: {
          queued: images.length,
          imageIds,
        },
      });
    } catch (error) {
      console.error("Error queueing bulk image extraction:", error);
      return c.json(
        {
          success: false,
          error: {
            code: "INTERNAL_ERROR",
            message: "Failed to queue image extraction",
          },
        },
        500
      );
    }
  }
);

/**
 * POST /api/v1/bookmarks/:bookmarkId/images/:imageId/skip
 *
 * Mark an image as skipped (won't be processed).
 */
imagesRouter.post("/:imageId/skip", async (c) => {
  const bookmarkId = c.req.param("bookmarkId");
  const imageId = c.req.param("imageId");

  if (!bookmarkId || !imageId) {
    return c.json(
      {
        success: false,
        error: { code: "BAD_REQUEST", message: "Missing required parameters" },
      },
      400
    );
  }

  const { userId } = c.get("auth");
  const { db } = await createAuthedDb(c.env.DATABASE_URL, userId);
  const bookmarkRepo = new BookmarkRepository(db);
  const contentImageRepo = new ContentImageRepository(db);

  try {
    // Verify bookmark exists
    const bookmark = await bookmarkRepo.findByIdForUser(userId, bookmarkId);
    if (!bookmark) {
      return c.json(
        {
          success: false,
          error: { code: "NOT_FOUND", message: "Bookmark not found" },
        },
        404
      );
    }

    // Verify image exists and belongs to bookmark
    const image = await contentImageRepo.findById(imageId);
    if (!image || image.bookmarkId !== bookmarkId) {
      return c.json(
        {
          success: false,
          error: { code: "NOT_FOUND", message: "Image not found" },
        },
        404
      );
    }

    // Can't skip if already processing
    if (image.status === "PROCESSING") {
      return c.json(
        {
          success: false,
          error: {
            code: "CANNOT_SKIP",
            message: "Cannot skip image that is currently processing",
          },
        },
        409
      );
    }

    // Update status to SKIPPED
    await contentImageRepo.updateStatus(imageId, "SKIPPED");

    console.log(`Image ${imageId} marked as skipped`);

    return c.json({
      success: true,
      data: { imageId, status: "SKIPPED" },
    });
  } catch (error) {
    console.error("Error skipping image:", error);
    return c.json(
      {
        success: false,
        error: { code: "INTERNAL_ERROR", message: "Failed to skip image" },
      },
      500
    );
  }
});

export { imagesRouter };
