import type {
  EmbeddingProvider,
  RerankerProvider,
} from "../providers/types.js";
import type {
  SearchRepository,
  HybridSearchResult,
} from "../repositories/search.js";
import type { BookmarkRepository } from "../repositories/bookmarks.js";

export interface SearchOptions {
  query: string;
  userId: string;
  topK?: number;
  topN?: number;
  threshold?: number;
}

export interface SearchResultItem {
  bookmarkId: string;
  bookmarkTitle: string | null;
  bookmarkUrl: string;
  chunkContent: string;
  breadcrumbPath: string | null;
  score: number;
}

const DEFAULT_TOP_K = 100;
const DEFAULT_TOP_N = 5;
const DEFAULT_RERANKER_THRESHOLD = 0.1;

export async function search(
  options: SearchOptions,
  embeddingProvider: EmbeddingProvider,
  rerankerProvider: RerankerProvider | null,
  searchRepo: SearchRepository,
  bookmarkRepo: BookmarkRepository
): Promise<SearchResultItem[]> {
  const { query, userId } = options;
  const topK = options.topK ?? DEFAULT_TOP_K;
  const topN = options.topN ?? DEFAULT_TOP_N;
  const rerankerThreshold = options.threshold ?? DEFAULT_RERANKER_THRESHOLD;

  const queryEmbedding = await embeddingProvider.embed(query);
  console.log(JSON.stringify(queryEmbedding));
  const hybridResults = await searchRepo.hybridSearch(
    userId,
    queryEmbedding,
    query,
    topK
  );

  if (hybridResults.length === 0) {
    return [];
  }

  let rankedResults: Array<HybridSearchResult & { finalScore: number }>;
  let useRerankerScores = false;

  if (rerankerProvider) {
    try {
      rankedResults = await rerankResults(
        query,
        hybridResults,
        rerankerProvider,
        topN
      );
      useRerankerScores = true;
    } catch (error) {
      console.warn("Reranking failed, falling back to RRF scores:", error);
      rankedResults = hybridResults.slice(0, topN).map((r) => ({
        ...r,
        finalScore: r.rrfScore,
      }));
    }
  } else {
    rankedResults = hybridResults.slice(0, topN).map((r) => ({
      ...r,
      finalScore: r.rrfScore,
    }));
  }

  // Only apply threshold to reranker scores (0-1 range).
  // RRF scores are rank-based (~0.01-0.03 range) and should not be thresholded.
  const filteredResults = useRerankerScores
    ? rankedResults.filter((r) => r.finalScore >= rerankerThreshold)
    : rankedResults;

  return enrichWithBookmarkMetadata(filteredResults, bookmarkRepo);
}

async function rerankResults(
  query: string,
  results: HybridSearchResult[],
  rerankerProvider: RerankerProvider,
  topN: number
): Promise<Array<HybridSearchResult & { finalScore: number }>> {
  const documents = results.map((r) => ({
    id: r.chunkId,
    content: r.content,
  }));

  const reranked = await rerankerProvider.rerank(query, documents, topN);

  return reranked.map((r) => {
    const original = results.find((res) => res.chunkId === r.id);
    if (!original) {
      throw new Error(
        `Rerank result with id ${r.id} not found in original results`
      );
    }
    return {
      ...original,
      finalScore: r.score,
    };
  });
}

async function enrichWithBookmarkMetadata(
  results: Array<HybridSearchResult & { finalScore: number }>,
  bookmarkRepo: BookmarkRepository
): Promise<SearchResultItem[]> {
  const bookmarkIds = [...new Set(results.map((r) => r.bookmarkId))];
  const bookmarksMap = await bookmarkRepo.findByIds(bookmarkIds);

  return results.map((r) => {
    const bookmark = bookmarksMap.get(r.bookmarkId);
    return {
      bookmarkId: r.bookmarkId,
      bookmarkTitle: bookmark?.title ?? null,
      bookmarkUrl: bookmark?.url ?? "",
      chunkContent: r.content,
      breadcrumbPath: r.breadcrumbPath,
      score: r.finalScore,
    };
  });
}
