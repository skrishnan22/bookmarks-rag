import { createOpenAI } from "@ai-sdk/openai";
import {
  APICallError,
  embed,
  embedMany,
  generateText,
  generateObject,
} from "ai";
import type { z } from "zod";
import { HttpError, parseRetryAfterSeconds } from "../utils/http-error.js";
import type {
  EmbeddingProvider,
  LLMProvider,
  LLMOptions,
  ChatMessage,
} from "./types.js";

const OPENROUTER_URL = "https://openrouter.ai/api/v1";
const DEFAULT_OPENROUTER_ERROR = "OpenRouter request failed";

function getStatusFromUnknown(error: unknown): number | undefined {
  if (!error || typeof error !== "object") {
    return undefined;
  }

  const record = error as Record<string, unknown>;
  const status = record.status;
  if (typeof status === "number") {
    return status;
  }

  const statusCode = record.statusCode;
  if (typeof statusCode === "number") {
    return statusCode;
  }

  const response = record.response;
  if (response && typeof response === "object") {
    const responseStatus = (response as Record<string, unknown>).status;
    if (typeof responseStatus === "number") {
      return responseStatus;
    }
  }

  return undefined;
}

function getRetryAfterSeconds(headers: unknown): number | undefined {
  if (headers instanceof Headers) {
    return parseRetryAfterSeconds(headers.get("retry-after"));
  }

  return undefined;
}

function mapOpenRouterError(error: unknown): never {
  if (APICallError.isInstance(error)) {
    const status = error.statusCode ?? getStatusFromUnknown(error) ?? 500;
    const message = error.message ?? DEFAULT_OPENROUTER_ERROR;
    const retryAfterSeconds = getRetryAfterSeconds(error.responseHeaders);

    const options: {
      message: string;
      status: number;
      url: string;
      cause: unknown;
      retryAfterSeconds?: number;
    } = {
      message,
      status,
      url: error.url ?? OPENROUTER_URL,
      cause: error,
    };

    if (retryAfterSeconds !== undefined) {
      options.retryAfterSeconds = retryAfterSeconds;
    }

    throw new HttpError(options);
  }

  const status = getStatusFromUnknown(error);
  if (status) {
    const message =
      error instanceof Error ? error.message : DEFAULT_OPENROUTER_ERROR;
    throw new HttpError({
      message,
      status,
      url: OPENROUTER_URL,
      cause: error,
    });
  }

  throw error;
}

export class OpenRouterEmbeddingProvider implements EmbeddingProvider {
  private openai;
  private model: string;

  constructor(apiKey: string, model: string = "openai/text-embedding-3-small") {
    this.openai = createOpenAI({
      apiKey,
      baseURL: "https://openrouter.ai/api/v1",
    });
    this.model = model;
  }

  async embed(text: string): Promise<number[]> {
    try {
      const { embedding } = await embed({
        model: this.openai.embedding(this.model),
        value: text,
      });
      return embedding;
    } catch (error) {
      mapOpenRouterError(error);
    }
  }

  async embedBatch(texts: string[]): Promise<number[][]> {
    if (texts.length === 0) {
      return [];
    }

    try {
      const { embeddings } = await embedMany({
        model: this.openai.embedding(this.model),
        values: texts,
      });
      return embeddings;
    } catch (error) {
      mapOpenRouterError(error);
    }
  }
}

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

  async complete(prompt: string, options?: LLMOptions): Promise<string> {
    try {
      const { text } = await generateText({
        model: this.openai(this.model),
        prompt,
        ...(options?.maxTokens && { maxOutputTokens: options.maxTokens }),
        ...(options?.temperature && { temperature: options.temperature }),
        ...(options?.stopSequences && { stopSequences: options.stopSequences }),
      });
      return text;
    } catch (error) {
      mapOpenRouterError(error);
    }
  }

  async chat(messages: ChatMessage[], options?: LLMOptions): Promise<string> {
    try {
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
    } catch (error) {
      mapOpenRouterError(error);
    }
  }

  async generateObject<T extends z.ZodTypeAny>(
    messages: ChatMessage[],
    schema: T,
    options?: LLMOptions
  ): Promise<z.infer<T>> {
    try {
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
    } catch (error) {
      mapOpenRouterError(error);
    }
  }
}
