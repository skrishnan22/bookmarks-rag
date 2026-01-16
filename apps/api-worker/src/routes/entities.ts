import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import {
  createDb,
  EntityRepository,
  entityTypeEnum,
} from "@rag-bookmarks/shared";
import type { Env } from "../types.js";

const TEST_USER_ID = "00000000-0000-0000-0000-000000000001";

const listEntitiesSchema = z.object({
  type: z.enum(entityTypeEnum).optional(),
  limit: z.coerce.number().min(1).max(100).optional().default(50),
  offset: z.coerce.number().min(0).optional().default(0),
});

const entityBookmarksSchema = z.object({
  limit: z.coerce.number().min(1).max(50).optional().default(20),
  offset: z.coerce.number().min(0).optional().default(0),
});

const entitiesRouter = new Hono<{ Bindings: Env }>();

// GET /api/v1/entities - List entities with optional type filter
entitiesRouter.get("/", zValidator("query", listEntitiesSchema), async (c) => {
  const { type, limit, offset } = c.req.valid("query");
  const { db } = createDb(c.env.DATABASE_URL);
  const entityRepo = new EntityRepository(db);
  const userId = TEST_USER_ID;

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
  const { db } = createDb(c.env.DATABASE_URL);
  const entityRepo = new EntityRepository(db);

  try {
    const entity = await entityRepo.findById(id);
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
    const { db } = createDb(c.env.DATABASE_URL);
    const entityRepo = new EntityRepository(db);

    try {
      const entity = await entityRepo.findById(id);
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
        entityRepo.getBookmarksForEntity(id, limit, offset),
        entityRepo.countBookmarksForEntity(id),
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
