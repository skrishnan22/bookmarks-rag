import type { Database } from "@rag-bookmarks/shared";
import {
  BookmarkRepository,
  createEmbeddingProvider,
  createRerankerProvider,
  createLLMProvider,
  runSynthesisPipeline,
  generateExcalidrawJson,
  runRenderPhase,
  buildSynthesisV2Result,
  generateFallbackComponents,
  type ExcalidrawFile,
  type SynthesisResult,
  type SynthesisV2Result,
  type ComponentSpec,
  type ThemeName,
  type SynthesisRunPhase,
} from "@rag-bookmarks/shared";
import { SearchRepository } from "../repositories/search.js";
import { search, type SearchResultItem } from "./search.js";

const SYNTHESIS_TOP_N = 30;
const MAX_CHUNKS_PER_BOOKMARK = 3;

export interface SynthesisArtifacts {
  synthesis: SynthesisResult;
  excalidraw: ExcalidrawFile;
}

interface BuildSynthesisArtifactsParams {
  query: string;
  userId: string;
  db: Database;
  jinaApiKey: string;
  openRouterApiKey: string;
  onPhaseChange?: (
    phase: "retrieval" | "map" | "reduce" | "excalidraw"
  ) => Promise<void> | void;
}

interface BuildSynthesisArtifactsV2Params {
  query: string;
  userId: string;
  db: Database;
  jinaApiKey: string;
  openRouterApiKey: string;
  theme?: ThemeName;
  onPhaseChange?: (phase: SynthesisRunPhase) => Promise<void> | void;
  onComponents?: (components: ComponentSpec[]) => Promise<void> | void;
}

export async function buildSynthesisArtifacts(
  params: BuildSynthesisArtifactsParams
): Promise<SynthesisArtifacts> {
  const { query, userId, db, jinaApiKey, openRouterApiKey, onPhaseChange } =
    params;
  const searchRepo = new SearchRepository(db);
  const bookmarkRepo = new BookmarkRepository(db);

  if (onPhaseChange) {
    await onPhaseChange("retrieval");
  }

  const embeddingProvider = createEmbeddingProvider(
    "jina",
    jinaApiKey,
    "jina-embeddings-v3",
    "retrieval.query"
  );
  const rerankerProvider = createRerankerProvider("jina", jinaApiKey);
  const llmProvider = createLLMProvider("openrouter", openRouterApiKey);

  const searchResults = await search(
    { query, userId, topN: SYNTHESIS_TOP_N },
    embeddingProvider,
    rerankerProvider,
    searchRepo,
    bookmarkRepo
  );

  const limitedResults = limitChunksPerBookmark(
    searchResults,
    MAX_CHUNKS_PER_BOOKMARK
  );

  const pipelineInput = limitedResults.map((result) => ({
    bookmarkId: result.bookmarkId,
    chunkId: result.chunkId,
    chunkContent: result.chunkContent,
    score: result.score,
  }));

  const synthesis = await runSynthesisPipeline(query, userId, pipelineInput, {
    bookmarkRepo,
    llmProvider,
    ...(onPhaseChange
      ? { onPhaseChange: (phase: "map" | "reduce") => onPhaseChange(phase) }
      : {}),
  });

  if (onPhaseChange) {
    await onPhaseChange("excalidraw");
  }

  const excalidraw = generateExcalidrawJson(synthesis);

  return {
    synthesis,
    excalidraw,
  };
}

function limitChunksPerBookmark(
  results: SearchResultItem[],
  maxPerBookmark: number
): SearchResultItem[] {
  const counts = new Map<string, number>();
  const limited: SearchResultItem[] = [];

  for (const result of results) {
    const currentCount = counts.get(result.bookmarkId) ?? 0;
    if (currentCount >= maxPerBookmark) {
      continue;
    }

    counts.set(result.bookmarkId, currentCount + 1);
    limited.push(result);
  }

  return limited;
}

/**
 * V2: Build synthesis with component-based visual rendering
 */
export async function buildSynthesisArtifactsV2(
  params: BuildSynthesisArtifactsV2Params
): Promise<SynthesisV2Result> {
  const {
    query,
    userId,
    db,
    jinaApiKey,
    openRouterApiKey,
    theme = "default",
    onPhaseChange,
    onComponents,
  } = params;

  const searchRepo = new SearchRepository(db);
  const bookmarkRepo = new BookmarkRepository(db);

  if (onPhaseChange) {
    await onPhaseChange("retrieval");
  }

  const embeddingProvider = createEmbeddingProvider(
    "jina",
    jinaApiKey,
    "jina-embeddings-v3",
    "retrieval.query"
  );
  const rerankerProvider = createRerankerProvider("jina", jinaApiKey);
  const llmProvider = createLLMProvider("openrouter", openRouterApiKey);

  const searchResults = await search(
    { query, userId, topN: SYNTHESIS_TOP_N },
    embeddingProvider,
    rerankerProvider,
    searchRepo,
    bookmarkRepo
  );

  const limitedResults = limitChunksPerBookmark(
    searchResults,
    MAX_CHUNKS_PER_BOOKMARK
  );

  const pipelineInput = limitedResults.map((result) => ({
    bookmarkId: result.bookmarkId,
    chunkId: result.chunkId,
    chunkContent: result.chunkContent,
    score: result.score,
  }));

  // Run the synthesis pipeline (map + reduce phases)
  const synthesis = await runSynthesisPipeline(query, userId, pipelineInput, {
    bookmarkRepo,
    llmProvider,
    ...(onPhaseChange
      ? { onPhaseChange: (phase: "map" | "reduce") => onPhaseChange(phase) }
      : {}),
  });

  // Run the render phase
  if (onPhaseChange) {
    await onPhaseChange("render");
  }

  let renderResult;
  try {
    const renderOptions: Parameters<typeof runRenderPhase>[1] = {
      llmProvider,
      theme,
    };
    if (onComponents) {
      renderOptions.onComponents = onComponents;
    }
    renderResult = await runRenderPhase(synthesis, renderOptions);
  } catch (error) {
    console.error("Render phase failed, using fallback:", error);
    // Generate fallback components from synthesis data
    const fallbackComponents = generateFallbackComponents(synthesis, theme);
    if (onComponents) {
      await onComponents(fallbackComponents);
    }
    renderResult = {
      components: fallbackComponents,
      theme,
    };
  }

  return buildSynthesisV2Result(synthesis, renderResult);
}
