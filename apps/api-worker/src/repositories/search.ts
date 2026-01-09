import { sql } from "drizzle-orm";
import type { Database } from "../db/index.js";

export interface HybridSearchResult {
  chunkId: string;
  bookmarkId: string;
  content: string;
  breadcrumbPath: string | null;
  rrfScore: number;
}

interface RawSearchResult {
  id: string;
  bookmark_id: string;
  content: string;
  breadcrumb_path: string | null;
  rrf_score: number;
}

interface RawVectorResult {
  id: string;
  bookmark_id: string;
  content: string;
  breadcrumb_path: string | null;
  similarity: number;
}

const RRF_K = 60;

export class SearchRepository {
  constructor(private db: Database) {}

  async hybridSearch(
    userId: string,
    queryEmbedding: number[],
    queryText: string,
    limit: number = 20
  ): Promise<HybridSearchResult[]> {
    const embeddingStr = `[${queryEmbedding.join(",")}]`;

    const results = await this.db.execute<{
      id: string;
      bookmark_id: string;
      content: string;
      breadcrumb_path: string | null;
      rrf_score: number;
    }>(sql`
      WITH vector_results AS (
        SELECT
          c.id,
          c.bookmark_id,
          c.content,
          c.breadcrumb_path,
          ROW_NUMBER() OVER (ORDER BY c.embedding <=> ${embeddingStr}::vector) as vector_rank
        FROM chunks c
        JOIN bookmarks b ON c.bookmark_id = b.id
        WHERE b.user_id = ${userId}
          AND c.embedding IS NOT NULL
        ORDER BY c.embedding <=> ${embeddingStr}::vector
        LIMIT 20
      ),
      bm25_results AS (
        SELECT
          c.id,
          c.bookmark_id,
          c.content,
          c.breadcrumb_path,
          ROW_NUMBER() OVER (
            ORDER BY ts_rank(c.content_tsv, plainto_tsquery('english', ${queryText})) DESC
          ) as bm25_rank
        FROM chunks c
        JOIN bookmarks b ON c.bookmark_id = b.id
        WHERE b.user_id = ${userId}
          AND c.content_tsv @@ plainto_tsquery('english', ${queryText})
        LIMIT 20
      ),
      combined AS (
        SELECT
          COALESCE(v.id, b.id) as id,
          COALESCE(v.bookmark_id, b.bookmark_id) as bookmark_id,
          COALESCE(v.content, b.content) as content,
          COALESCE(v.breadcrumb_path, b.breadcrumb_path) as breadcrumb_path,
          COALESCE(1.0 / (${RRF_K} + v.vector_rank), 0) +
          COALESCE(1.0 / (${RRF_K} + b.bm25_rank), 0) as rrf_score
        FROM vector_results v
        FULL OUTER JOIN bm25_results b ON v.id = b.id
      )
      SELECT * FROM combined
      ORDER BY rrf_score DESC
      LIMIT ${limit}
    `);

    return (results as unknown as RawSearchResult[]).map((row) => ({
      chunkId: row.id,
      bookmarkId: row.bookmark_id,
      content: row.content,
      breadcrumbPath: row.breadcrumb_path,
      rrfScore: row.rrf_score,
    }));
  }

  async vectorOnlySearch(
    userId: string,
    queryEmbedding: number[],
    limit: number = 20
  ): Promise<HybridSearchResult[]> {
    const embeddingStr = `[${queryEmbedding.join(",")}]`;

    const results = await this.db.execute(sql`
      SELECT
        c.id,
        c.bookmark_id,
        c.content,
        c.breadcrumb_path,
        1 - (c.embedding <=> ${embeddingStr}::vector) as similarity
      FROM chunks c
      JOIN bookmarks b ON c.bookmark_id = b.id
      WHERE b.user_id = ${userId}
        AND c.embedding IS NOT NULL
      ORDER BY c.embedding <=> ${embeddingStr}::vector
      LIMIT ${limit}
    `);

    return (results as unknown as RawVectorResult[]).map((row) => ({
      chunkId: row.id,
      bookmarkId: row.bookmark_id,
      content: row.content,
      breadcrumbPath: row.breadcrumb_path,
      rrfScore: row.similarity,
    }));
  }
}
