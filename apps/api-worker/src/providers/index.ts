/**
 * Provider factory functions
 *
 * Creates the appropriate provider based on configuration.
 * This allows swapping providers without changing business logic.
 */

import type {
  EmbeddingProvider,
  LLMProvider,
  RerankerProvider,
} from "./types.js";
import {
  OpenRouterEmbeddingProvider,
  OpenRouterLLMProvider,
} from "./openrouter.js";
import { JinaEmbeddingProvider, JinaRerankerProvider } from "./jina.js";

export type {
  EmbeddingProvider,
  LLMProvider,
  RerankerProvider,
  LLMOptions,
  ChatMessage,
  RerankDocument,
  RerankResult,
} from "./types.js";

/**
 * Create an embedding provider
 *
 * Supported providers:
 * - openrouter: OpenRouter API
 * - jina: Jina AI embeddings (recommended)
 */
export function createEmbeddingProvider(
  provider: "openrouter" | "openai" | "voyage" | "jina",
  apiKey: string,
  model?: string
): EmbeddingProvider {
  switch (provider) {
    case "openrouter":
      return new OpenRouterEmbeddingProvider(apiKey, model);
    case "jina":
      return new JinaEmbeddingProvider(apiKey, model);
    case "openai":
      throw new Error("OpenAI provider not yet implemented");
    case "voyage":
      throw new Error("Voyage provider not yet implemented");
    default:
      throw new Error(`Unknown embedding provider: ${provider}`);
  }
}

/**
 * Create an LLM provider
 *
 * Supported providers:
 * - openrouter: OpenRouter API (default)
 */
export function createLLMProvider(
  provider: "openrouter" | "openai" | "anthropic",
  apiKey: string,
  model?: string
): LLMProvider {
  switch (provider) {
    case "openrouter":
      return new OpenRouterLLMProvider(apiKey, model);
    case "openai":
      throw new Error("OpenAI provider not yet implemented");
    case "anthropic":
      throw new Error("Anthropic provider not yet implemented");
    default:
      throw new Error(`Unknown LLM provider: ${provider}`);
  }
}

/**
 * Create a reranker provider
 *
 * Supported providers:
 * - jina: Jina AI reranker
 */
export function createRerankerProvider(
  provider: "jina",
  apiKey: string,
  model?: string
): RerankerProvider {
  switch (provider) {
    case "jina":
      return new JinaRerankerProvider(apiKey, model);
    default:
      throw new Error(`Unknown reranker provider: ${provider}`);
  }
}
