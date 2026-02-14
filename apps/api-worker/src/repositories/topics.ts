import { eq, and, desc, sql, inArray } from "drizzle-orm";
import {
  type Database,
  topics,
  bookmarkTopics,
  bookmarks,
  type Topic,
  type NewTopic,
  type BookmarkTopic,
} from "@rag-bookmarks/shared";

export interface CreateTopicParams {
  userId: string;
  name: string;
  description?: string;
  keywords?: string[];
  centroid?: number[];
  isUncategorized?: boolean;
}

export interface UpdateTopicParams {
  id: string;
  name?: string;
  description?: string;
  keywords?: string[];
  centroid?: number[];
  bookmarkCount?: number;
}

export interface TopicWithStats extends Topic {
  bookmarkCount: number;
}

export class TopicRepository {
  constructor(private db: Database) {}

  async create(params: CreateTopicParams): Promise<Topic> {
    const result = await this.db
      .insert(topics)
      .values({
        userId: params.userId,
        name: params.name,
        description: params.description,
        keywords: params.keywords ?? [],
        centroid: params.centroid,
        isUncategorized: params.isUncategorized ? 1 : 0,
      })
      .returning();

    if (!result[0]) {
      throw new Error("Failed to create topic");
    }
    return result[0];
  }

  async createMany(paramsArray: CreateTopicParams[]): Promise<Topic[]> {
    if (paramsArray.length === 0) return [];

    const values = paramsArray.map((p) => ({
      userId: p.userId,
      name: p.name,
      description: p.description,
      keywords: p.keywords ?? [],
      centroid: p.centroid,
      isUncategorized: p.isUncategorized ? 1 : 0,
    }));

    return this.db.insert(topics).values(values).returning();
  }

  async findById(id: string): Promise<Topic | null> {
    const result = await this.db
      .select()
      .from(topics)
      .where(eq(topics.id, id))
      .limit(1);

    return result[0] ?? null;
  }

  async findByIdForUser(userId: string, id: string): Promise<Topic | null> {
    const result = await this.db
      .select()
      .from(topics)
      .where(and(eq(topics.id, id), eq(topics.userId, userId)))
      .limit(1);

    return result[0] ?? null;
  }

  async findByUserId(userId: string): Promise<Topic[]> {
    return this.db
      .select()
      .from(topics)
      .where(eq(topics.userId, userId))
      .orderBy(desc(topics.bookmarkCount));
  }

  async findByUserIdWithCentroids(
    userId: string
  ): Promise<Array<{ id: string; centroid: number[] | null }>> {
    const result = await this.db
      .select({ id: topics.id, centroid: topics.centroid })
      .from(topics)
      .where(and(eq(topics.userId, userId), eq(topics.isUncategorized, 0)));

    return result;
  }

  async findUncategorizedTopic(userId: string): Promise<Topic | null> {
    const result = await this.db
      .select()
      .from(topics)
      .where(and(eq(topics.userId, userId), eq(topics.isUncategorized, 1)))
      .limit(1);

    return result[0] ?? null;
  }

  async getOrCreateUncategorizedTopic(userId: string): Promise<Topic> {
    const existing = await this.findUncategorizedTopic(userId);
    if (existing) return existing;

    return this.create({
      userId,
      name: "Uncategorized",
      description: "Bookmarks that don't fit well into any topic",
      isUncategorized: true,
    });
  }

  async update(params: UpdateTopicParams): Promise<Topic | null> {
    const { id, ...fields } = params;

    const result = await this.db
      .update(topics)
      .set({
        ...fields,
        updatedAt: new Date(),
      })
      .where(eq(topics.id, id))
      .returning();

    return result[0] ?? null;
  }

  async updateCentroids(
    updates: Array<{ id: string; centroid: number[] }>
  ): Promise<void> {
    for (const update of updates) {
      await this.db
        .update(topics)
        .set({ centroid: update.centroid, updatedAt: new Date() })
        .where(eq(topics.id, update.id));
    }
  }

  async delete(id: string): Promise<void> {
    await this.db.delete(topics).where(eq(topics.id, id));
  }

  async deleteAllForUser(userId: string): Promise<void> {
    await this.db.delete(topics).where(eq(topics.userId, userId));
  }

  async countByUserId(userId: string): Promise<number> {
    const result = await this.db
      .select({ count: sql<number>`count(*)` })
      .from(topics)
      .where(eq(topics.userId, userId));

    return Number(result[0]?.count ?? 0);
  }

  async refreshBookmarkCounts(userId: string): Promise<void> {
    const counts = await this.db
      .select({
        topicId: bookmarkTopics.topicId,
        count: sql<number>`count(*)`,
      })
      .from(bookmarkTopics)
      .innerJoin(topics, eq(bookmarkTopics.topicId, topics.id))
      .where(eq(topics.userId, userId))
      .groupBy(bookmarkTopics.topicId);

    for (const { topicId, count } of counts) {
      await this.db
        .update(topics)
        .set({ bookmarkCount: Number(count) })
        .where(eq(topics.id, topicId));
    }
  }
}

export class BookmarkTopicRepository {
  constructor(private db: Database) {}

  async assign(
    bookmarkId: string,
    assignments: Array<{ topicId: string; score: number }>
  ): Promise<BookmarkTopic[]> {
    if (assignments.length === 0) return [];

    const values = assignments.map((a) => ({
      bookmarkId,
      topicId: a.topicId,
      score: a.score,
    }));

    return this.db
      .insert(bookmarkTopics)
      .values(values)
      .onConflictDoUpdate({
        target: [bookmarkTopics.bookmarkId, bookmarkTopics.topicId],
        set: { score: sql`excluded.score` },
      })
      .returning();
  }

  async findByBookmarkId(bookmarkId: string): Promise<BookmarkTopic[]> {
    return this.db
      .select()
      .from(bookmarkTopics)
      .where(eq(bookmarkTopics.bookmarkId, bookmarkId))
      .orderBy(desc(bookmarkTopics.score));
  }

  async findByTopicId(
    topicId: string,
    limit: number = 50,
    offset: number = 0
  ): Promise<Array<{ bookmarkId: string; score: number }>> {
    return this.db
      .select({
        bookmarkId: bookmarkTopics.bookmarkId,
        score: bookmarkTopics.score,
      })
      .from(bookmarkTopics)
      .where(eq(bookmarkTopics.topicId, topicId))
      .orderBy(desc(bookmarkTopics.score))
      .limit(limit)
      .offset(offset);
  }

  async findBookmarksForTopic(
    topicId: string,
    minScore: number = 0,
    limit: number = 100
  ): Promise<
    Array<{
      bookmark: {
        id: string;
        title: string | null;
        url: string;
      };
      score: number;
    }>
  > {
    const result = await this.db
      .select({
        bookmark: {
          id: bookmarks.id,
          title: bookmarks.title,
          url: bookmarks.url,
        },
        score: bookmarkTopics.score,
      })
      .from(bookmarkTopics)
      .innerJoin(bookmarks, eq(bookmarkTopics.bookmarkId, bookmarks.id))
      .where(
        and(
          eq(bookmarkTopics.topicId, topicId),
          sql`${bookmarkTopics.score} >= ${minScore}`
        )
      )
      .orderBy(desc(bookmarkTopics.score))
      .limit(limit);

    return result;
  }

  async deleteByBookmarkId(bookmarkId: string): Promise<void> {
    await this.db
      .delete(bookmarkTopics)
      .where(eq(bookmarkTopics.bookmarkId, bookmarkId));
  }

  async deleteByTopicId(topicId: string): Promise<void> {
    await this.db
      .delete(bookmarkTopics)
      .where(eq(bookmarkTopics.topicId, topicId));
  }

  async deleteAllForUser(userId: string): Promise<void> {
    await this.db.delete(bookmarkTopics).where(
      sql`${bookmarkTopics.bookmarkId} IN (
          SELECT id FROM ${bookmarks} WHERE user_id = ${userId}
        )`
    );
  }

  async countOutliers(
    userId: string,
    maxScoreThreshold: number
  ): Promise<number> {
    const result = await this.db.execute(sql`
      SELECT COUNT(DISTINCT b.id) as count
      FROM ${bookmarks} b
      LEFT JOIN ${bookmarkTopics} bt ON b.id = bt.bookmark_id
      WHERE b.user_id = ${userId}
        AND b.status = 'DONE'
        AND b.topic_embedding IS NOT NULL
        AND (bt.bookmark_id IS NULL OR (
          SELECT MAX(bt2.score) FROM ${bookmarkTopics} bt2 WHERE bt2.bookmark_id = b.id
        ) < ${maxScoreThreshold})
    `);

    return Number((result as any)[0]?.count ?? 0);
  }
}

export type { Topic, BookmarkTopic };
