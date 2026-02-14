import type { ModelMessage } from "ai";
import type { z } from "zod";

/**
 * Provider interfaces for AI services
 */

export interface EmbeddingProvider {
  embed(text: string): Promise<number[]>;
  embedBatch(texts: string[]): Promise<number[][]>;
}

export interface LLMProvider {
  complete(prompt: string, options?: LLMOptions): Promise<string>;
  chat(messages: ChatMessage[], options?: LLMOptions): Promise<string>;
  generateObject<T extends z.ZodTypeAny>(
    messages: ChatMessage[],
    schema: T,
    options?: LLMOptions
  ): Promise<z.infer<T>>;
}

export interface LLMOptions {
  maxTokens?: number;
  temperature?: number;
  stopSequences?: string[];
}

export type ChatMessage = ModelMessage;

export type MessageContent = Extract<ModelMessage, { role: "user" }>["content"];

export type MessageContentPart =
  MessageContent extends Array<infer Part> ? Part : never;

export interface RerankDocument {
  id: string;
  content: string;
}

export interface RerankResult {
  id: string;
  score: number;
  index: number;
}

export interface RerankerProvider {
  rerank(
    query: string,
    documents: RerankDocument[],
    topN?: number
  ): Promise<RerankResult[]>;
}

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
