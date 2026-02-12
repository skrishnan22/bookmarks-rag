import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { createDb, BookmarkRepository } from "@rag-bookmarks/shared";
import type { AppContext } from "../types.js";
import {
  TopicRepository,
  BookmarkTopicRepository,
} from "../repositories/topics.js";
import { requireAuth } from "../middleware/auth.js";

const listTopicsSchema = z.object({
  limit: z.coerce.number().min(1).max(100).optional().default(50),
  offset: z.coerce.number().min(0).optional().default(0),
});

const topicBookmarksSchema = z.object({
  limit: z.coerce.number().min(1).max(100).optional().default(50),
  offset: z.coerce.number().min(0).optional().default(0),
  minScore: z.coerce.number().min(0).max(1).optional().default(0),
});

const updateTopicSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  description: z.string().max(500).optional(),
});

const topicsRouter = new Hono<AppContext>();

topicsRouter.use("*", requireAuth);

topicsRouter.get("/", zValidator("query", listTopicsSchema), async (c) => {
  const { limit, offset } = c.req.valid("query");
  const { userId } = c.get("auth");
  const { db } = createDb(c.env.DATABASE_URL);
  const topicRepo = new TopicRepository(db);

  try {
    const topics = await topicRepo.findByUserId(userId);
    const paginated = topics.slice(offset, offset + limit);

    return c.json({
      success: true,
      data: {
        topics: paginated.map((t) => ({
          id: t.id,
          name: t.name,
          description: t.description,
          keywords: t.keywords,
          bookmarkCount: t.bookmarkCount,
          isUncategorized: t.isUncategorized === 1,
          createdAt: t.createdAt,
          updatedAt: t.updatedAt,
        })),
        total: topics.length,
      },
    });
  } catch (error) {
    console.error("Error listing topics:", error);
    return c.json(
      {
        success: false,
        error: { code: "INTERNAL_ERROR", message: "Failed to list topics" },
      },
      500
    );
  }
});

topicsRouter.get("/:id", async (c) => {
  const { id } = c.req.param();
  const { userId } = c.get("auth");
  const { db } = createDb(c.env.DATABASE_URL);
  const topicRepo = new TopicRepository(db);

  try {
    const topic = await topicRepo.findById(id);
    if (!topic || topic.userId !== userId) {
      return c.json(
        {
          success: false,
          error: { code: "NOT_FOUND", message: "Topic not found" },
        },
        404
      );
    }

    return c.json({
      success: true,
      data: {
        id: topic.id,
        name: topic.name,
        description: topic.description,
        keywords: topic.keywords,
        bookmarkCount: topic.bookmarkCount,
        isUncategorized: topic.isUncategorized === 1,
        createdAt: topic.createdAt,
        updatedAt: topic.updatedAt,
      },
    });
  } catch (error) {
    console.error("Error fetching topic:", error);
    return c.json(
      {
        success: false,
        error: { code: "INTERNAL_ERROR", message: "Failed to fetch topic" },
      },
      500
    );
  }
});

topicsRouter.get(
  "/:id/bookmarks",
  zValidator("query", topicBookmarksSchema),
  async (c) => {
    const { id } = c.req.param();
    const { limit, offset, minScore } = c.req.valid("query");
    const { userId } = c.get("auth");
    const { db } = createDb(c.env.DATABASE_URL);
    const topicRepo = new TopicRepository(db);
    const bookmarkTopicRepo = new BookmarkTopicRepository(db);
    const bookmarkRepo = new BookmarkRepository(db);

    try {
      const topic = await topicRepo.findById(id);
      if (!topic || topic.userId !== userId) {
        return c.json(
          {
            success: false,
            error: { code: "NOT_FOUND", message: "Topic not found" },
          },
          404
        );
      }

      const assignments = await bookmarkTopicRepo.findByTopicId(
        id,
        limit + offset,
        0
      );
      const paginated = assignments.slice(offset, offset + limit);
      const filteredByScore = paginated.filter((a) => a.score >= minScore);

      const bookmarkIds = filteredByScore.map((a) => a.bookmarkId);
      const bookmarksMap = await bookmarkRepo.findByIds(bookmarkIds);

      const bookmarksWithScore = filteredByScore
        .map((a) => {
          const bookmark = bookmarksMap.get(a.bookmarkId);
          if (!bookmark) return null;
          return {
            id: bookmark.id,
            url: bookmark.url,
            title: bookmark.title,
            summary: bookmark.summary,
            favicon: bookmark.favicon,
            topicScore: a.score,
            createdAt: bookmark.createdAt,
          };
        })
        .filter((b) => b !== null);

      return c.json({
        success: true,
        data: {
          topic: {
            id: topic.id,
            name: topic.name,
          },
          bookmarks: bookmarksWithScore,
          total: assignments.length,
        },
      });
    } catch (error) {
      console.error("Error fetching topic bookmarks:", error);
      return c.json(
        {
          success: false,
          error: {
            code: "INTERNAL_ERROR",
            message: "Failed to fetch topic bookmarks",
          },
        },
        500
      );
    }
  }
);

topicsRouter.put("/:id", zValidator("json", updateTopicSchema), async (c) => {
  const { id } = c.req.param();
  const updates = c.req.valid("json");
  const { userId } = c.get("auth");
  const { db } = createDb(c.env.DATABASE_URL);
  const topicRepo = new TopicRepository(db);

  try {
    const topic = await topicRepo.findById(id);
    if (!topic || topic.userId !== userId) {
      return c.json(
        {
          success: false,
          error: { code: "NOT_FOUND", message: "Topic not found" },
        },
        404
      );
    }

    const updated = await topicRepo.update({
      id,
      ...(updates.name && { name: updates.name }),
      ...(updates.description && { description: updates.description }),
    });

    return c.json({
      success: true,
      data: {
        id: updated?.id,
        name: updated?.name,
        description: updated?.description,
      },
    });
  } catch (error) {
    console.error("Error updating topic:", error);
    return c.json(
      {
        success: false,
        error: { code: "INTERNAL_ERROR", message: "Failed to update topic" },
      },
      500
    );
  }
});

// TODO: Re-enable when clustering worker is implemented
// topicsRouter.post("/recluster", async (c) => {
//   const { db } = createDb(c.env.DATABASE_URL);
//   const bookmarkRepo = new BookmarkRepository(db);
//   const { userId } = c.get("auth");
//
//   try {
//     const bookmarkCount =
//       await bookmarkRepo.countWithTopicEmbeddingByUserId(userId);
//
//     await c.env.CLUSTERING_QUEUE.send({
//       userId,
//       reason: "manual_trigger",
//       bookmarkCount,
//     });
//
//     return c.json({
//       success: true,
//       data: {
//         message: "Clustering job enqueued",
//         bookmarkCount,
//       },
//     });
//   } catch (error) {
//     console.error("Error enqueuing recluster:", error);
//     return c.json(
//       {
//         success: false,
//         error: {
//           code: "INTERNAL_ERROR",
//           message: "Failed to enqueue clustering",
//         },
//       },
//       500
//     );
//   }
// });

export { topicsRouter };
