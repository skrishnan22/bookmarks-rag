import { eq, and, asc, inArray, gte } from "drizzle-orm";
import type { Database } from "../db/index.js";
import {
  contentImages,
  type ContentImage,
  type NewContentImage,
  type ContentImageStatus,
  type ImageExtractionResult,
} from "../db/schema.js";

export interface CreateContentImageParams {
  bookmarkId: string;
  url: string;
  altText?: string | undefined;
  title?: string | undefined;
  nearbyText?: string | undefined;
  position: number;
  urlDomain?: string | undefined;
  estimatedType?: string | undefined;
  heuristicScore?: number | undefined;
}

export interface UpdateContentImageParams {
  id: string;
  status?: ContentImageStatus;
  processedAt?: Date;
  errorMessage?: string;
  extractedEntities?: ImageExtractionResult;
}

export class ContentImageRepository {
  constructor(private db: Database) {}

  async create(params: CreateContentImageParams): Promise<ContentImage> {
    const result = await this.db
      .insert(contentImages)
      .values({
        bookmarkId: params.bookmarkId,
        url: params.url,
        altText: params.altText,
        title: params.title,
        nearbyText: params.nearbyText,
        position: params.position,
        urlDomain: params.urlDomain,
        estimatedType: params.estimatedType,
        heuristicScore: params.heuristicScore,
        status: "PENDING",
      })
      .returning();

    if (!result[0]) {
      throw new Error("Failed to create content image");
    }
    return result[0];
  }

  async createMany(
    paramsArray: CreateContentImageParams[]
  ): Promise<ContentImage[]> {
    if (paramsArray.length === 0) {
      return [];
    }

    const values: NewContentImage[] = paramsArray.map((params) => ({
      bookmarkId: params.bookmarkId,
      url: params.url,
      altText: params.altText,
      title: params.title,
      nearbyText: params.nearbyText,
      position: params.position,
      urlDomain: params.urlDomain,
      estimatedType: params.estimatedType,
      heuristicScore: params.heuristicScore,
      status: "PENDING" as ContentImageStatus,
    }));

    return this.db.insert(contentImages).values(values).returning();
  }

  async findById(id: string): Promise<ContentImage | null> {
    const result = await this.db
      .select()
      .from(contentImages)
      .where(eq(contentImages.id, id))
      .limit(1);

    return result[0] ?? null;
  }

  async findByBookmarkId(bookmarkId: string): Promise<ContentImage[]> {
    return this.db
      .select()
      .from(contentImages)
      .where(eq(contentImages.bookmarkId, bookmarkId))
      .orderBy(asc(contentImages.position));
  }

  async findByBookmarkIdWithMinScore(
    bookmarkId: string,
    minScore: number
  ): Promise<ContentImage[]> {
    return this.db
      .select()
      .from(contentImages)
      .where(
        and(
          eq(contentImages.bookmarkId, bookmarkId),
          gte(contentImages.heuristicScore, minScore)
        )
      )
      .orderBy(asc(contentImages.position));
  }

  async findPendingByBookmarkId(bookmarkId: string): Promise<ContentImage[]> {
    return this.db
      .select()
      .from(contentImages)
      .where(
        and(
          eq(contentImages.bookmarkId, bookmarkId),
          eq(contentImages.status, "PENDING")
        )
      )
      .orderBy(asc(contentImages.position));
  }

  async update(params: UpdateContentImageParams): Promise<ContentImage | null> {
    const { id, ...fields } = params;

    const result = await this.db
      .update(contentImages)
      .set({
        ...fields,
        updatedAt: new Date(),
      })
      .where(eq(contentImages.id, id))
      .returning();

    return result[0] ?? null;
  }

  async updateStatus(id: string, status: ContentImageStatus): Promise<void> {
    await this.db
      .update(contentImages)
      .set({
        status,
        updatedAt: new Date(),
      })
      .where(eq(contentImages.id, id));
  }

  async updateStatusBulk(
    ids: string[],
    status: ContentImageStatus
  ): Promise<void> {
    if (ids.length === 0) return;

    await this.db
      .update(contentImages)
      .set({
        status,
        updatedAt: new Date(),
      })
      .where(inArray(contentImages.id, ids));
  }

  async deleteByBookmarkId(bookmarkId: string): Promise<void> {
    await this.db
      .delete(contentImages)
      .where(eq(contentImages.bookmarkId, bookmarkId));
  }

  async countByBookmarkId(bookmarkId: string): Promise<number> {
    const result = await this.db
      .select()
      .from(contentImages)
      .where(eq(contentImages.bookmarkId, bookmarkId));

    return result.length;
  }
}

export type { ContentImage, ContentImageStatus };
