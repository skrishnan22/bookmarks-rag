import { eq, and, desc, inArray } from "drizzle-orm";
import type { Database } from "../db/index.js";
import { bookmarks, type Bookmark, type BookmarkStatus } from "../db/schema.js";

export interface CreateBookmarkParams {
  userId: string;
  url: string;
}

export interface UpdateBookmarkParams {
  id: string;
  title?: string;
  description?: string;
  favicon?: string;
  ogImage?: string;
  summary?: string;
  markdown?: string;
  status?: BookmarkStatus;
  errorMessage?: string;
}

export class BookmarkRepository {
  constructor(private db: Database) {}

  async create(params: CreateBookmarkParams): Promise<Bookmark> {
    const result = await this.db
      .insert(bookmarks)
      .values({
        userId: params.userId,
        url: params.url,
        status: "PENDING",
      })
      .returning();

    if (!result[0]) {
      throw new Error("Failed to create bookmark");
    }
    return result[0];
  }

  async findById(id: string): Promise<Bookmark | null> {
    const result = await this.db
      .select()
      .from(bookmarks)
      .where(eq(bookmarks.id, id))
      .limit(1);

    return result[0] ?? null;
  }

  async findByUserAndUrl(
    userId: string,
    url: string
  ): Promise<Bookmark | null> {
    const result = await this.db
      .select()
      .from(bookmarks)
      .where(and(eq(bookmarks.userId, userId), eq(bookmarks.url, url)))
      .limit(1);

    return result[0] ?? null;
  }

  async update(params: UpdateBookmarkParams): Promise<Bookmark | null> {
    const { id, ...fields } = params;

    const result = await this.db
      .update(bookmarks)
      .set({
        ...fields,
        updatedAt: new Date(),
      })
      .where(eq(bookmarks.id, id))
      .returning();

    return result[0] ?? null;
  }

  async listByUser(
    userId: string,
    limit: number = 20,
    offset: number = 0
  ): Promise<Bookmark[]> {
    return this.db
      .select()
      .from(bookmarks)
      .where(eq(bookmarks.userId, userId))
      .orderBy(desc(bookmarks.createdAt))
      .limit(limit)
      .offset(offset);
  }

  async findByIds(ids: string[]): Promise<Map<string, Bookmark>> {
    if (ids.length === 0) {
      return new Map();
    }

    const results = await this.db
      .select()
      .from(bookmarks)
      .where(inArray(bookmarks.id, ids));

    return new Map(results.map((b) => [b.id, b]));
  }

  async delete(id: string, userId: string): Promise<boolean> {
    const result = await this.db
      .delete(bookmarks)
      .where(and(eq(bookmarks.id, id), eq(bookmarks.userId, userId)))
      .returning({ id: bookmarks.id });

    return result.length > 0;
  }
}

export type { Bookmark, BookmarkStatus };
