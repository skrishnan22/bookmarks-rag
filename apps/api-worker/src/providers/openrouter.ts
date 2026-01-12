/**
 * OpenRouter provider implementation using Vercel AI SDK
 *
 * OpenRouter provides access to multiple models through a unified API.
 * We use @ai-sdk/openai with a custom baseURL for OpenRouter compatibility.
 */

import { createOpenAI } from "@ai-sdk/openai";
import { embed, embedMany, generateText, generateObject } from "ai";
import type { z } from "zod";
import type {
  EmbeddingProvider,
  LLMProvider,
  LLMOptions,
  ChatMessage,
} from "./types.js";

/**
 * OpenRouter Embedding Provider
 *
 * Uses OpenRouter to generate embeddings via text-embedding-3-small (or other models)
 */
export class OpenRouterEmbeddingProvider implements EmbeddingProvider {
  private openai;
  private model: string;

  constructor(apiKey: string, model: string = "openai/text-embedding-3-small") {
    // Create OpenAI-compatible client pointing to OpenRouter
    this.openai = createOpenAI({
      apiKey,
      baseURL: "https://openrouter.ai/api/v1",
    });
    this.model = model;
  }

  /**
   * Generate embedding for a single text
   */
  async embed(text: string): Promise<number[]> {
    const { embedding } = await embed({
      model: this.openai.embedding(this.model),
      value: text,
    });
    return embedding;
  }

  /**
   * Generate embeddings for multiple texts
   * Uses embedMany for efficient batch processing
   */
  async embedBatch(texts: string[]): Promise<number[][]> {
    if (texts.length === 0) {
      return [];
    }

    const { embeddings } = await embedMany({
      model: this.openai.embedding(this.model),
      values: texts,
    });
    return embeddings;
  }
}

/**
 * OpenRouter LLM Provider
 *
 * Uses OpenRouter for text generation (context, summaries, etc.)
 */
export class OpenRouterLLMProvider implements LLMProvider {
  private openai;
  private model: string;

  constructor(apiKey: string, model: string = "openai/gpt-4o-mini") {
    this.openai = createOpenAI({
      apiKey,
      baseURL: "https://openrouter.ai/api/v1",
    });
    this.model = model;
  }

  /**
   * Generate a completion for a simple prompt
   */
  async complete(prompt: string, options?: LLMOptions): Promise<string> {
    const { text } = await generateText({
      model: this.openai(this.model),
      prompt,
      ...(options?.maxTokens && { maxOutputTokens: options.maxTokens }),
      ...(options?.temperature && { temperature: options.temperature }),
      ...(options?.stopSequences && { stopSequences: options.stopSequences }),
    });
    return text;
  }

  /**
   * Generate a completion with structured messages
   */
  async chat(messages: ChatMessage[], options?: LLMOptions): Promise<string> {
    const { text } = await generateText({
      model: this.openai(this.model),
      messages: messages.map((m) => ({
        role: m.role,
        content: m.content,
      })),
      ...(options?.maxTokens && { maxOutputTokens: options.maxTokens }),
      ...(options?.temperature && { temperature: options.temperature }),
      ...(options?.stopSequences && { stopSequences: options.stopSequences }),
    });
    return text;
  }

  async generateObject<T extends z.ZodTypeAny>(
    messages: ChatMessage[],
    schema: T,
    options?: LLMOptions
  ): Promise<z.infer<T>> {
    const { object } = await generateObject({
      model: this.openai(this.model),
      messages: messages.map((m) => ({
        role: m.role,
        content: m.content,
      })),
      schema,
      ...(options?.maxTokens && { maxOutputTokens: options.maxTokens }),
      ...(options?.temperature && { temperature: options.temperature }),
    });
    return object;
  }
}
