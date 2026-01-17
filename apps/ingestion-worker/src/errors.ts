import type { HttpError } from "@rag-bookmarks/shared";

type ErrorCode = string;

interface ErrorOptions {
  code: ErrorCode;
  message: string;
  cause?: unknown;
}

export class RetryableError extends Error {
  override name = "RetryableError";
  override cause?: unknown;
  code: ErrorCode;

  constructor({ code, message, cause }: ErrorOptions) {
    super(message);
    this.code = code;
    this.cause = cause;
  }
}

export class NonRetryableError extends Error {
  override name = "NonRetryableError";
  override cause?: unknown;
  code: ErrorCode;

  constructor({ code, message, cause }: ErrorOptions) {
    super(message);
    this.code = code;
    this.cause = cause;
  }
}

function isAbortError(error: unknown): boolean {
  if (error && typeof error === "object" && "name" in error) {
    return (error as { name?: string }).name === "AbortError";
  }
  return false;
}

function hasStatus(error: unknown): error is HttpError {
  return Boolean(error && typeof error === "object" && "status" in error);
}

export function isRetryableError(error: unknown): boolean {
  if (error instanceof RetryableError) {
    return true;
  }

  if (error instanceof NonRetryableError) {
    return false;
  }

  if (hasStatus(error)) {
    const status = error.status;
    if ([408, 409, 425, 429].includes(status)) {
      return true;
    }
    if (status >= 500 && status <= 599) {
      return true;
    }
    if ([400, 401, 403, 404, 422].includes(status)) {
      return false;
    }
    if (status >= 400 && status <= 499) {
      return false;
    }
  }

  if (isAbortError(error)) {
    return true;
  }

  if (error instanceof TypeError) {
    return true;
  }

  return false;
}
