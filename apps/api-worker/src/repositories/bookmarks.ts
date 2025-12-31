import { eq, and, desc } from "drizzle-orm";
import type { Database } from "../db/index.js";
import { bookmarks, type Bookmark, type BookmarkStatus } from "../db/schema.js";

// Params for creating a bookmark
export interface CreateBookmarkParams {
  userId: string;
  url: string;
}

// Params for updating a bookmark - all fields optional except id
export interface UpdateBookmarkParams {
  id: string;
  title?: string;
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

  /**
   * Find a bookmark by ID
   * Returns null if not found (expected case, not an error)
   */
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

  /**
   * Update a bookmark's fields
   * Only updates fields that are explicitly provided (not undefined)
   * Drizzle automatically ignores undefined values in .set()
   */
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

  /**
   * List bookmarks for a user with pagination
   */
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
}

// Re-export types for convenience
export type { Bookmark, BookmarkStatus };
