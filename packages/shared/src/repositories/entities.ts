import { eq, and, inArray, count, desc } from "drizzle-orm";
import type { Database } from "../db/index.js";
import {
  entities,
  entityBookmarks,
  bookmarks,
  type Entity,
  type EntityType,
  type EntityStatus,
  type EntityMetadata,
  type EntityBookmark,
  type Bookmark,
  type SearchCandidates,
} from "../db/schema.js";

export interface CreateEntityParams {
  userId: string;
  type: EntityType;
  name: string;
  normalizedName: string;
  externalId?: string;
  status?: EntityStatus;
  metadata?: EntityMetadata;
}

export interface LinkEntityToBookmarkParams {
  entityId: string;
  bookmarkId: string;
  contextSnippet?: string;
  confidence: number;
}

export class EntityRepository {
  constructor(private db: Database) {}

  async findByNormalizedName(
    userId: string,
    type: EntityType,
    normalizedName: string
  ): Promise<Entity | null> {
    const result = await this.db
      .select()
      .from(entities)
      .where(
        and(
          eq(entities.userId, userId),
          eq(entities.type, type),
          eq(entities.normalizedName, normalizedName)
        )
      )
      .limit(1);

    return result[0] ?? null;
  }

  async create(params: CreateEntityParams): Promise<Entity> {
    const result = await this.db
      .insert(entities)
      .values({
        userId: params.userId,
        type: params.type,
        name: params.name,
        normalizedName: params.normalizedName,
        externalId: params.externalId,
        status: params.status ?? "PENDING",
        metadata: params.metadata,
      })
      .returning();

    if (!result[0]) {
      throw new Error("Failed to create entity");
    }
    return result[0];
  }

  async updateMetadata(
    id: string,
    metadata: EntityMetadata,
    status: EntityStatus,
    externalId?: string
  ): Promise<Entity | null> {
    const result = await this.db
      .update(entities)
      .set({
        metadata,
        status,
        externalId,
        updatedAt: new Date(),
      })
      .where(eq(entities.id, id))
      .returning();

    return result[0] ?? null;
  }

  async linkToBookmark(
    params: LinkEntityToBookmarkParams
  ): Promise<EntityBookmark> {
    const result = await this.db
      .insert(entityBookmarks)
      .values({
        entityId: params.entityId,
        bookmarkId: params.bookmarkId,
        contextSnippet: params.contextSnippet,
        confidence: params.confidence,
      })
      .onConflictDoNothing()
      .returning();

    if (!result[0]) {
      const existing = await this.db
        .select()
        .from(entityBookmarks)
        .where(
          and(
            eq(entityBookmarks.entityId, params.entityId),
            eq(entityBookmarks.bookmarkId, params.bookmarkId)
          )
        )
        .limit(1);
      if (!existing[0]) {
        throw new Error("Failed to link entity to bookmark");
      }
      return existing[0];
    }
    return result[0];
  }

  async findByBookmarkId(bookmarkId: string): Promise<Entity[]> {
    const result = await this.db
      .select({ entity: entities })
      .from(entities)
      .innerJoin(entityBookmarks, eq(entities.id, entityBookmarks.entityId))
      .where(eq(entityBookmarks.bookmarkId, bookmarkId));

    return result.map((r) => r.entity);
  }

  async findByUserAndType(userId: string, type: EntityType): Promise<Entity[]> {
    return this.db
      .select()
      .from(entities)
      .where(and(eq(entities.userId, userId), eq(entities.type, type)));
  }

  async findPendingByUser(userId: string): Promise<Entity[]> {
    return this.db
      .select()
      .from(entities)
      .where(and(eq(entities.userId, userId), eq(entities.status, "PENDING")));
  }

  async findByIds(ids: string[]): Promise<Entity[]> {
    if (ids.length === 0) return [];
    return this.db.select().from(entities).where(inArray(entities.id, ids));
  }

  async findById(id: string): Promise<Entity | null> {
    const result = await this.db
      .select()
      .from(entities)
      .where(eq(entities.id, id))
      .limit(1);
    return result[0] ?? null;
  }

  async listByUserWithCounts(
    userId: string,
    type?: EntityType,
    limit: number = 50,
    offset: number = 0
  ): Promise<(Entity & { bookmarkCount: number })[]> {
    const conditions = [eq(entities.userId, userId)];
    if (type) {
      conditions.push(eq(entities.type, type));
    }

    const result = await this.db
      .select({
        entity: entities,
        bookmarkCount: count(entityBookmarks.bookmarkId),
      })
      .from(entities)
      .leftJoin(entityBookmarks, eq(entities.id, entityBookmarks.entityId))
      .where(and(...conditions))
      .groupBy(entities.id)
      .orderBy(desc(entities.createdAt))
      .limit(limit)
      .offset(offset);

    return result.map((r) => ({
      ...r.entity,
      bookmarkCount: r.bookmarkCount,
    }));
  }

  async countByUserAndType(userId: string, type?: EntityType): Promise<number> {
    const conditions = [eq(entities.userId, userId)];
    if (type) {
      conditions.push(eq(entities.type, type));
    }

    const result = await this.db
      .select({ count: count() })
      .from(entities)
      .where(and(...conditions));

    return result[0]?.count ?? 0;
  }

  async getBookmarksForEntity(
    entityId: string,
    limit: number = 20,
    offset: number = 0
  ): Promise<
    (Pick<Bookmark, "id" | "url" | "title" | "summary" | "favicon" | "ogImage" | "createdAt"> & {
      contextSnippet: string | null;
      confidence: number;
    })[]
  > {
    const result = await this.db
      .select({
        id: bookmarks.id,
        url: bookmarks.url,
        title: bookmarks.title,
        summary: bookmarks.summary,
        favicon: bookmarks.favicon,
        ogImage: bookmarks.ogImage,
        createdAt: bookmarks.createdAt,
        contextSnippet: entityBookmarks.contextSnippet,
        confidence: entityBookmarks.confidence,
      })
      .from(entityBookmarks)
      .innerJoin(bookmarks, eq(entityBookmarks.bookmarkId, bookmarks.id))
      .where(eq(entityBookmarks.entityId, entityId))
      .orderBy(desc(entityBookmarks.confidence))
      .limit(limit)
      .offset(offset);

    return result;
  }

  async countBookmarksForEntity(entityId: string): Promise<number> {
    const result = await this.db
      .select({ count: count() })
      .from(entityBookmarks)
      .where(eq(entityBookmarks.entityId, entityId));

    return result[0]?.count ?? 0;
  }

  async updateSearchCandidates(
    id: string,
    candidates: SearchCandidates
  ): Promise<void> {
    await this.db
      .update(entities)
      .set({
        searchCandidates: candidates,
        updatedAt: new Date(),
      })
      .where(eq(entities.id, id));
  }

  async updateStatus(id: string, status: EntityStatus): Promise<void> {
    await this.db
      .update(entities)
      .set({
        status,
        updatedAt: new Date(),
      })
      .where(eq(entities.id, id));
  }

  async findByStatus(userId: string, status: EntityStatus): Promise<Entity[]> {
    return this.db
      .select()
      .from(entities)
      .where(and(eq(entities.userId, userId), eq(entities.status, status)));
  }

  async findPendingEntitiesForBookmark(
    userId: string,
    bookmarkId: string
  ): Promise<Entity[]> {
    const result = await this.db
      .select({ entity: entities })
      .from(entities)
      .innerJoin(entityBookmarks, eq(entities.id, entityBookmarks.entityId))
      .where(
        and(
          eq(entityBookmarks.bookmarkId, bookmarkId),
          eq(entities.userId, userId),
          inArray(entities.status, ["PENDING", "CANDIDATES_FOUND"])
        )
      );

    return result.map((r) => r.entity);
  }
}

export type {
  Entity,
  EntityType,
  EntityStatus,
  EntityMetadata,
  EntityBookmark,
  SearchCandidates,
};
