/**
 * Jina AI provider for embeddings and reranking
 */
import { z } from "zod";
import type {
  EmbeddingProvider,
  RerankerProvider,
  RerankDocument,
  RerankResult,
} from "./types.js";

const JINA_API_BASE = "https://api.jina.ai/v1";
const DEFAULT_EMBEDDING_MODEL = "jina-embeddings-v3";
const DEFAULT_RERANKER_MODEL = "jina-reranker-v2-base-multilingual";

// Zod schemas for API response validation
const jinaEmbeddingResponseSchema = z.object({
  data: z.array(
    z.object({
      embedding: z.array(z.number()),
      index: z.number(),
    })
  ),
  usage: z.object({
    total_tokens: z.number(),
  }),
});

const jinaRerankResponseSchema = z.object({
  results: z.array(
    z.object({
      index: z.number(),
      relevance_score: z.number(),
    })
  ),
  usage: z.object({
    total_tokens: z.number(),
  }),
});

const jinaErrorResponseSchema = z.object({
  detail: z.string(),
});

export type JinaEmbeddingTask = "retrieval.query" | "retrieval.passage";

export class JinaEmbeddingProvider implements EmbeddingProvider {
  private apiKey: string;
  private model: string;
  private task: JinaEmbeddingTask | undefined;

  constructor(
    apiKey: string,
    model: string = DEFAULT_EMBEDDING_MODEL,
    task?: JinaEmbeddingTask
  ) {
    this.apiKey = apiKey;
    this.model = model;
    this.task = task;
  }

  async embed(text: string): Promise<number[]> {
    const results = await this.embedBatch([text]);
    const embedding = results[0];
    if (!embedding) {
      throw new Error("Jina embedding error: no embedding returned");
    }
    return embedding;
  }

  async embedBatch(texts: string[]): Promise<number[][]> {
    if (texts.length === 0) {
      return [];
    }

    const body: Record<string, unknown> = {
      model: this.model,
      input: texts,
    };

    if (this.task) {
      body.task = this.task;
      body.normalized = true;
    }

    const response = await fetch(`${JINA_API_BASE}/embeddings`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errorJson = await response.json().catch(() => ({}));
      const errorResult = jinaErrorResponseSchema.safeParse(errorJson);
      const errorMessage = errorResult.success ? errorResult.data.detail : undefined;
      throw new Error(
        `Jina embedding error: ${errorMessage || response.statusText}`
      );
    }

    const json = await response.json();
    const data = jinaEmbeddingResponseSchema.parse(json);

    const sorted = data.data.sort((a, b) => a.index - b.index);
    return sorted.map((item) => item.embedding);
  }
}

export class JinaRerankerProvider implements RerankerProvider {
  private apiKey: string;
  private model: string;

  constructor(apiKey: string, model: string = DEFAULT_RERANKER_MODEL) {
    this.apiKey = apiKey;
    this.model = model;
  }

  async rerank(
    query: string,
    documents: RerankDocument[],
    topN?: number
  ): Promise<RerankResult[]> {
    if (documents.length === 0) {
      return [];
    }

    const response = await fetch(`${JINA_API_BASE}/rerank`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: this.model,
        query,
        top_n: topN ?? documents.length,
        documents: documents.map((doc) => doc.content),
        return_documents: false,
      }),
    });

    if (!response.ok) {
      const errorJson = await response.json().catch(() => ({}));
      const errorResult = jinaErrorResponseSchema.safeParse(errorJson);
      const errorMessage = errorResult.success ? errorResult.data.detail : undefined;
      throw new Error(
        `Jina rerank error: ${errorMessage || response.statusText}`
      );
    }

    const json = await response.json();
    const data = jinaRerankResponseSchema.parse(json);

    return data.results.map((result) => {
      const doc = documents[result.index];
      if (!doc) {
        throw new Error(`Jina rerank error: invalid index ${result.index}`);
      }
      return {
        id: doc.id,
        score: result.relevance_score,
        index: result.index,
      };
    });
  }
}
