import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import {
  createAuthedDb,
  EntityRepository,
  entityTypeEnum,
} from "@rag-bookmarks/shared";
import type { AppContext } from "../types.js";

const listEntitiesSchema = z.object({
  type: z.enum(entityTypeEnum).optional(),
  limit: z.coerce.number().min(1).max(100).optional().default(50),
  offset: z.coerce.number().min(0).optional().default(0),
});

const entityBookmarksSchema = z.object({
  limit: z.coerce.number().min(1).max(50).optional().default(20),
  offset: z.coerce.number().min(0).optional().default(0),
});

const entitiesRouter = new Hono<AppContext>();

// GET /api/v1/entities - List entities with optional type filter
entitiesRouter.get("/", zValidator("query", listEntitiesSchema), async (c) => {
  const { type, limit, offset } = c.req.valid("query");
  const { userId } = c.get("auth");
  const { db } = await createAuthedDb(c.env.DATABASE_URL, userId);
  const entityRepo = new EntityRepository(db);

  try {
    const [entitiesWithCounts, total] = await Promise.all([
      entityRepo.listByUserWithCounts(userId, type, limit, offset),
      entityRepo.countByUserAndType(userId, type),
    ]);

    return c.json({
      success: true,
      data: {
        entities: entitiesWithCounts.map((e) => ({
          id: e.id,
          type: e.type,
          name: e.name,
          status: e.status,
          metadata: e.metadata,
          bookmarkCount: e.bookmarkCount,
          createdAt: e.createdAt,
        })),
        total,
      },
    });
  } catch (error) {
    console.error("Error listing entities:", error);
    return c.json(
      {
        success: false,
        error: { code: "INTERNAL_ERROR", message: "Failed to list entities" },
      },
      500
    );
  }
});

// GET /api/v1/entities/:id - Get single entity
entitiesRouter.get("/:id", async (c) => {
  const { id } = c.req.param();
  const { userId } = c.get("auth");
  const { db } = await createAuthedDb(c.env.DATABASE_URL, userId);
  const entityRepo = new EntityRepository(db);

  try {
    const entity = await entityRepo.findByIdForUser(userId, id);
    if (!entity) {
      return c.json(
        {
          success: false,
          error: { code: "NOT_FOUND", message: "Entity not found" },
        },
        404
      );
    }

    const bookmarkCount = await entityRepo.countBookmarksForEntity(id);

    return c.json({
      success: true,
      data: {
        id: entity.id,
        type: entity.type,
        name: entity.name,
        status: entity.status,
        metadata: entity.metadata,
        bookmarkCount,
        createdAt: entity.createdAt,
        updatedAt: entity.updatedAt,
      },
    });
  } catch (error) {
    console.error("Error getting entity:", error);
    return c.json(
      {
        success: false,
        error: { code: "INTERNAL_ERROR", message: "Failed to get entity" },
      },
      500
    );
  }
});

// GET /api/v1/entities/:id/bookmarks - Get bookmarks mentioning this entity
entitiesRouter.get(
  "/:id/bookmarks",
  zValidator("query", entityBookmarksSchema),
  async (c) => {
    const { id } = c.req.param();
    const { limit, offset } = c.req.valid("query");
    const { userId } = c.get("auth");
    const { db } = await createAuthedDb(c.env.DATABASE_URL, userId);
    const entityRepo = new EntityRepository(db);

    try {
      const entity = await entityRepo.findByIdForUser(userId, id);
      if (!entity) {
        return c.json(
          {
            success: false,
            error: { code: "NOT_FOUND", message: "Entity not found" },
          },
          404
        );
      }

      const [entityBookmarks, total] = await Promise.all([
        entityRepo.getBookmarksForEntityForUser(userId, id, limit, offset),
        entityRepo.countBookmarksForEntityForUser(userId, id),
      ]);

      return c.json({
        success: true,
        data: {
          entity: {
            id: entity.id,
            name: entity.name,
            type: entity.type,
          },
          bookmarks: entityBookmarks.map((b) => ({
            id: b.id,
            url: b.url,
            title: b.title,
            summary: b.summary,
            favicon: b.favicon,
            ogImage: b.ogImage,
            contextSnippet: b.contextSnippet,
            confidence: b.confidence,
            createdAt: b.createdAt,
          })),
          total,
        },
      });
    } catch (error) {
      console.error("Error getting entity bookmarks:", error);
      return c.json(
        {
          success: false,
          error: {
            code: "INTERNAL_ERROR",
            message: "Failed to get entity bookmarks",
          },
        },
        500
      );
    }
  }
);

export { entitiesRouter };
