import type { z } from "zod";

/**
 * Provider interfaces for AI services
 *
 * These interfaces allow swapping between different providers
 * (OpenRouter, OpenAI direct, Voyage, etc.) without changing business logic.
 */

/**
 * Embedding provider interface
 */
export interface EmbeddingProvider {
  /**
   * Generate embedding for a single text
   */
  embed(text: string): Promise<number[]>;

  /**
   * Generate embeddings for multiple texts (batch)
   * More efficient than calling embed() multiple times
   */
  embedBatch(texts: string[]): Promise<number[][]>;
}

/**
 * LLM provider interface for text generation
 */
export interface LLMProvider {
  complete(prompt: string, options?: LLMOptions): Promise<string>;

  chat(messages: ChatMessage[], options?: LLMOptions): Promise<string>;

  generateObject<T extends z.ZodTypeAny>(
    messages: ChatMessage[],
    schema: T,
    options?: LLMOptions
  ): Promise<z.infer<T>>;
}

/**
 * Options for LLM generation
 */
export interface LLMOptions {
  maxTokens?: number;
  temperature?: number;
  stopSequences?: string[];
}

/**
 * Chat message format
 */
export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

/**
 * Document to be reranked
 */
export interface RerankDocument {
  id: string;
  content: string;
}

/**
 * Result from reranking
 */
export interface RerankResult {
  id: string;
  score: number;
  index: number;
}

/**
 * Reranker provider interface for result reranking
 */
export interface RerankerProvider {
  rerank(
    query: string,
    documents: RerankDocument[],
    topN?: number
  ): Promise<RerankResult[]>;
}

/**
 * Provider configuration
 */
export interface ProviderConfig {
  embedding: {
    provider: "openrouter" | "openai" | "voyage" | "jina";
    model: string;
    apiKey: string;
  };
  llm: {
    provider: "openrouter" | "openai" | "anthropic";
    model: string;
    apiKey: string;
  };
  reranker?: {
    provider: "jina";
    model: string;
    apiKey: string;
  };
}
