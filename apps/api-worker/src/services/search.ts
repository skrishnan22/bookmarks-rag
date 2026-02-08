import type {
  EmbeddingProvider,
  RerankerProvider,
  BookmarkRepository,
} from "@rag-bookmarks/shared";
import type {
  SearchRepository,
  HybridSearchResult,
} from "../repositories/search.js";

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
  bookmarkFavicon: string | null;
  bookmarkOgImage: string | null;
  bookmarkDescription: string | null;
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

  const embeddingStart = performance.now();
  const queryEmbedding = await embeddingProvider.embed(query);
  const embeddingDuration = performance.now() - embeddingStart;
  console.log(
    JSON.stringify({
      step: "query_embedding",
      duration_ms: embeddingDuration,
    })
  );

  const hybridSearchStart = performance.now();
  const hybridResults = await searchRepo.hybridSearch(
    userId,
    queryEmbedding,
    query,
    topK
  );
  const hybridSearchDuration = performance.now() - hybridSearchStart;
  console.log(
    JSON.stringify({
      step: "hybrid_search",
      duration_ms: hybridSearchDuration,
      results_count: hybridResults.length,
    })
  );

  if (hybridResults.length === 0) {
    return [];
  }

  let rankedResults: Array<HybridSearchResult & { finalScore: number }>;
  let useRerankerScores = false;

  if (rerankerProvider) {
    try {
      const rerankStart = performance.now();
      rankedResults = await rerankResults(
        query,
        hybridResults,
        rerankerProvider,
        topN
      );
      const rerankDuration = performance.now() - rerankStart;
      console.log(
        JSON.stringify({
          step: "rerank",
          duration_ms: rerankDuration,
          results_count: rankedResults.length,
        })
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

  const filteredResults = useRerankerScores
    ? rankedResults.filter((r) => r.finalScore >= rerankerThreshold)
    : rankedResults;

  const enrichmentStart = performance.now();
  const finalResults = await enrichWithBookmarkMetadata(
    filteredResults,
    userId,
    bookmarkRepo
  );
  const enrichmentDuration = performance.now() - enrichmentStart;
  console.log(
    JSON.stringify({
      step: "metadata_enrichment",
      duration_ms: enrichmentDuration,
      results_count: finalResults.length,
    })
  );

  return finalResults;
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
  userId: string,
  bookmarkRepo: BookmarkRepository
): Promise<SearchResultItem[]> {
  const bookmarkIds = [...new Set(results.map((r) => r.bookmarkId))];
  const bookmarksMap = await bookmarkRepo.findByIdsForUser(userId, bookmarkIds);

  return results.map((r) => {
    const bookmark = bookmarksMap.get(r.bookmarkId);
    return {
      bookmarkId: r.bookmarkId,
      bookmarkTitle: bookmark?.title ?? null,
      bookmarkUrl: bookmark?.url ?? "",
      bookmarkFavicon: bookmark?.favicon ?? null,
      bookmarkOgImage: bookmark?.ogImage ?? null,
      bookmarkDescription: bookmark?.description ?? null,
      chunkContent: r.content,
      breadcrumbPath: r.breadcrumbPath,
      score: r.finalScore,
    };
  });
}
