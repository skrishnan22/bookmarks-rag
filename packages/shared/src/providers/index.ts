/**
 * Provider factory functions
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
import {
  JinaEmbeddingProvider,
  JinaRerankerProvider,
  type JinaEmbeddingTask,
} from "./jina.js";

export type {
  EmbeddingProvider,
  LLMProvider,
  RerankerProvider,
  LLMOptions,
  ChatMessage,
  RerankDocument,
  RerankResult,
} from "./types.js";

export function createEmbeddingProvider(
  provider: "openrouter" | "openai" | "voyage" | "jina",
  apiKey: string,
  model?: string,
  task?: JinaEmbeddingTask
): EmbeddingProvider {
  switch (provider) {
    case "openrouter":
      return new OpenRouterEmbeddingProvider(apiKey, model);
    case "jina":
      return new JinaEmbeddingProvider(apiKey, model, task);
    case "openai":
      throw new Error("OpenAI provider not yet implemented");
    case "voyage":
      throw new Error("Voyage provider not yet implemented");
    default:
      throw new Error(`Unknown embedding provider: ${provider}`);
  }
}

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

export { OpenRouterEmbeddingProvider, OpenRouterLLMProvider } from "./openrouter.js";
export { JinaEmbeddingProvider, JinaRerankerProvider, type JinaEmbeddingTask } from "./jina.js";
