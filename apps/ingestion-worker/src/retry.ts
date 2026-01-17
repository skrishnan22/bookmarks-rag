import pRetry from "p-retry";
import { HttpError } from "@rag-bookmarks/shared";
import { isRetryableError } from "./errors.js";

const DEFAULT_RETRIES = 2;
const DEFAULT_BASE_DELAY_SECONDS = 2;
const DEFAULT_MAX_DELAY_SECONDS = 30;

interface RetryOptions {
  retries?: number;
  baseDelaySeconds?: number;
  maxDelaySeconds?: number;
}

function toSeconds(value: number | undefined, fallback: number): number {
  if (!value || Number.isNaN(value) || value <= 0) {
    return fallback;
  }
  return value;
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function getRetryAfterSeconds(error: unknown): number | undefined {
  if (error instanceof HttpError && error.retryAfterSeconds !== undefined) {
    return error.retryAfterSeconds;
  }
  return undefined;
}

export async function withRetry<T>(
  fn: () => Promise<T>,
  options: RetryOptions = {}
): Promise<T> {
  const retries = options.retries ?? DEFAULT_RETRIES;
  const baseDelaySeconds = toSeconds(
    options.baseDelaySeconds,
    DEFAULT_BASE_DELAY_SECONDS
  );
  const maxDelaySeconds = toSeconds(
    options.maxDelaySeconds,
    DEFAULT_MAX_DELAY_SECONDS
  );

  return pRetry(fn, {
    retries,
    factor: 2,
    minTimeout: baseDelaySeconds * 1000,
    maxTimeout: maxDelaySeconds * 1000,
    randomize: true,
    onFailedAttempt: async ({ error }: { error: unknown }) => {
      const retryAfter = getRetryAfterSeconds(error);
      if (retryAfter && retryAfter > 0) {
        await delay(retryAfter * 1000);
      }
    },
    shouldRetry: ({ error }: { error: unknown }) => isRetryableError(error),
  });
}
