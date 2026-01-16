import { eq, asc, isNull, and } from "drizzle-orm";
import type { Database } from "../db/index.js";
import { chunks, type Chunk, type NewChunk } from "../db/schema.js";

export interface CreateChunkParams {
  bookmarkId: string;
  content: string;
  position: number;
  tokenCount: number;
  breadcrumbPath: string;
}

export interface UpdateChunkParams {
  id: string;
  context?: string;
  contextualizedContent?: string;
  embedding?: number[];
}

export class ChunkRepository {
  constructor(private db: Database) {}

  async create(params: CreateChunkParams): Promise<Chunk> {
    const result = await this.db
      .insert(chunks)
      .values({
        bookmarkId: params.bookmarkId,
        content: params.content,
        position: params.position,
        tokenCount: params.tokenCount,
        breadcrumbPath: params.breadcrumbPath,
      })
      .returning();

    if (!result[0]) {
      throw new Error("Failed to create chunk");
    }
    return result[0];
  }

  async createMany(paramsArray: CreateChunkParams[]): Promise<Chunk[]> {
    if (paramsArray.length === 0) {
      return [];
    }

    const values: NewChunk[] = paramsArray.map((params) => ({
      bookmarkId: params.bookmarkId,
      content: params.content,
      position: params.position,
      tokenCount: params.tokenCount,
      breadcrumbPath: params.breadcrumbPath,
    }));

    return this.db.insert(chunks).values(values).returning();
  }

  async findById(id: string): Promise<Chunk | null> {
    const result = await this.db
      .select()
      .from(chunks)
      .where(eq(chunks.id, id))
      .limit(1);

    return result[0] ?? null;
  }

  async findByBookmarkId(bookmarkId: string): Promise<Chunk[]> {
    return this.db
      .select()
      .from(chunks)
      .where(eq(chunks.bookmarkId, bookmarkId))
      .orderBy(asc(chunks.position));
  }

  async update(params: UpdateChunkParams): Promise<Chunk | null> {
    const { id, ...fields } = params;

    const result = await this.db
      .update(chunks)
      .set(fields)
      .where(eq(chunks.id, id))
      .returning();

    return result[0] ?? null;
  }

  async updateEmbeddings(
    updates: { id: string; embedding: number[] }[]
  ): Promise<void> {
    for (const update of updates) {
      await this.db
        .update(chunks)
        .set({ embedding: update.embedding })
        .where(eq(chunks.id, update.id));
    }
  }

  async deleteByBookmarkId(bookmarkId: string): Promise<void> {
    await this.db.delete(chunks).where(eq(chunks.bookmarkId, bookmarkId));
  }

  async countByBookmarkId(bookmarkId: string): Promise<number> {
    const result = await this.db
      .select()
      .from(chunks)
      .where(eq(chunks.bookmarkId, bookmarkId));

    return result.length;
  }

  async findChunksWithoutEmbeddings(bookmarkId: string): Promise<Chunk[]> {
    return this.db
      .select()
      .from(chunks)
      .where(and(eq(chunks.bookmarkId, bookmarkId), isNull(chunks.embedding)))
      .orderBy(asc(chunks.position));
  }
}

export type { Chunk };
