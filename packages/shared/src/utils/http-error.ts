export class HttpError extends Error {
  override name = "HttpError";
  status: number;
  url?: string;
  retryAfterSeconds?: number;
  override cause?: unknown;

  constructor(options: {
    message: string;
    status: number;
    url?: string;
    retryAfterSeconds?: number;
    cause?: unknown;
  }) {
    super(options.message);
    this.status = options.status;
    if (options.url !== undefined) {
      this.url = options.url;
    }
    if (options.retryAfterSeconds !== undefined) {
      this.retryAfterSeconds = options.retryAfterSeconds;
    }
    if (options.cause !== undefined) {
      this.cause = options.cause;
    }
  }
}

export function parseRetryAfterSeconds(
  headerValue: string | null
): number | undefined {
  if (!headerValue) {
    return undefined;
  }

  const numeric = Number.parseInt(headerValue, 10);
  if (!Number.isNaN(numeric)) {
    return numeric;
  }

  const timestamp = Date.parse(headerValue);
  if (Number.isNaN(timestamp)) {
    return undefined;
  }

  const seconds = Math.ceil((timestamp - Date.now()) / 1000);
  return Math.max(0, seconds);
}
