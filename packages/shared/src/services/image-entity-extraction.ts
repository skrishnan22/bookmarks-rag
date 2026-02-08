import { z } from "zod";
import { createOpenAI } from "@ai-sdk/openai";
import { APICallError, generateObject } from "ai";
import type {
  ImageExtractionResult,
  ImageExtractedEntity,
} from "../db/schema.js";
import { HttpError, parseRetryAfterSeconds } from "../utils/http-error.js";
import type { MessageContent } from "../providers/types.js";

const MODEL_ID = "openai/gpt-4o-mini";
const OPENROUTER_URL = "https://openrouter.ai/api/v1";

// Maximum image size to process (5MB)
const MAX_IMAGE_SIZE = 5 * 1024 * 1024;

// Supported image MIME types (raster formats that vision models can process)
const SUPPORTED_MIME_TYPES = [
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
];

// MIME types that are images but unsupported by vision models
const UNSUPPORTED_IMAGE_TYPES: Record<string, string> = {
  "image/svg+xml": "SVG (vector graphics)",
  "image/x-icon": "ICO (favicon)",
  "image/vnd.microsoft.icon": "ICO (favicon)",
  "application/pdf": "PDF",
  "image/tiff": "TIFF",
  "image/bmp": "BMP",
};

const JPEG_SIGNATURE = [0xff, 0xd8, 0xff];
const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47];
const GIF_SIGNATURE = [0x47, 0x49, 0x46, 0x38];
const RIFF_SIGNATURE = [0x52, 0x49, 0x46, 0x46];
const WEBP_SIGNATURE = [0x57, 0x45, 0x42, 0x50];
const RASTER_EXTENSIONS = ["jpg", "jpeg", "png", "gif", "webp"];

export class UnsupportedImageError extends Error {
  override name = "UnsupportedImageError";
  mimeType: string;

  constructor(message: string, mimeType: string) {
    super(message);
    this.mimeType = mimeType;
  }
}

function matchesSignature(bytes: Uint8Array, signature: number[]): boolean {
  if (bytes.length < signature.length) {
    return false;
  }
  return signature.every((byte, index) => bytes[index] === byte);
}

function sniffMimeType(bytes: Uint8Array): string | undefined {
  if (matchesSignature(bytes, JPEG_SIGNATURE)) {
    return "image/jpeg";
  }
  if (matchesSignature(bytes, PNG_SIGNATURE)) {
    return "image/png";
  }
  if (matchesSignature(bytes, GIF_SIGNATURE)) {
    return "image/gif";
  }
  if (matchesSignature(bytes, RIFF_SIGNATURE) && bytes.length >= 12) {
    const webpHeader = bytes.slice(8, 12);
    if (matchesSignature(webpHeader, WEBP_SIGNATURE)) {
      return "image/webp";
    }
  }

  const textSample = new TextDecoder()
    .decode(bytes.slice(0, 256))
    .toLowerCase();
  if (textSample.includes("<svg")) {
    return "image/svg+xml";
  }

  return undefined;
}

function normalizeMimeType(contentType: string | null): string | undefined {
  if (!contentType) {
    return undefined;
  }
  const baseType = contentType.split(";")[0]?.trim().toLowerCase();
  return baseType || undefined;
}

function guessMimeTypeFromUrl(url: string): string | undefined {
  try {
    const parsed = new URL(url);
    const extension = parsed.pathname.split(".").pop()?.toLowerCase();
    if (!extension) {
      return undefined;
    }

    if (!RASTER_EXTENSIONS.includes(extension)) {
      return undefined;
    }

    switch (extension) {
      case "jpg":
      case "jpeg":
        return "image/jpeg";
      case "png":
        return "image/png";
      case "gif":
        return "image/gif";
      case "webp":
        return "image/webp";
      default:
        return undefined;
    }
  } catch {
    return undefined;
  }
}

/**
 * Fetch an image from URL and return as Uint8Array.
 * This ensures we can send images that might be protected or require specific headers.
 */
async function fetchImageAsData(imageUrl: string): Promise<Uint8Array> {
  const response = await fetch(imageUrl, {
    headers: {
      // Some servers require a user agent
      "User-Agent":
        "Mozilla/5.0 (compatible; BookmarkBot/1.0; +https://example.com/bot)",
      Accept: "image/*",
    },
  });

  if (!response.ok) {
    throw new Error(
      `Failed to fetch image: ${response.status} ${response.statusText}`
    );
  }

  const arrayBuffer = await response.arrayBuffer();

  if (arrayBuffer.byteLength > MAX_IMAGE_SIZE) {
    throw new Error(
      `Image too large: ${(arrayBuffer.byteLength / 1024 / 1024).toFixed(1)}MB exceeds ${MAX_IMAGE_SIZE / 1024 / 1024}MB limit`
    );
  }

  const bytes = new Uint8Array(arrayBuffer);
  const contentType = normalizeMimeType(response.headers.get("content-type"));
  const sniffedType = sniffMimeType(bytes);
  const urlType = guessMimeTypeFromUrl(imageUrl);
  const mimeType = sniffedType ?? contentType ?? urlType ?? "";

  if (!SUPPORTED_MIME_TYPES.includes(mimeType)) {
    const friendlyName = UNSUPPORTED_IMAGE_TYPES[mimeType];
    if (friendlyName) {
      throw new UnsupportedImageError(
        `Cannot process ${friendlyName} - vision models only support JPEG, PNG, GIF, and WebP`,
        mimeType
      );
    }

    if (!mimeType) {
      throw new UnsupportedImageError(
        "Unsupported image type: unknown. Only JPEG, PNG, GIF, and WebP are supported.",
        "unknown"
      );
    }

    throw new UnsupportedImageError(
      `Unsupported image type: ${mimeType}. Only JPEG, PNG, GIF, and WebP are supported.`,
      mimeType
    );
  }

  return bytes;
}

const extractionEntitySchema = z.object({
  type: z.enum(["book", "movie", "tv_show"]),
  name: z.string(),
  confidence: z.number().min(0).max(1),
  hints: z
    .object({
      author: z.string().nullable(),
      director: z.string().nullable(),
      year: z.number().nullable(),
    })
    .nullable(),
});

const extractionResponseSchema = z.object({
  entities: z.array(extractionEntitySchema),
  imageDescription: z.string().nullable(),
});

const EXTRACTION_PROMPT = `Analyze this image and extract any identifiable media entities.

For each entity found, provide:
- type: "book" | "movie" | "tv_show"
- name: The title as shown
- confidence: 0.0-1.0 how certain you are
- hints: Any additional info visible (author, year, actors, etc.)

If this is a book cover, movie poster, DVD/Blu-ray case, or similar media image, extract the entity.
If no clear media entities are visible, return an empty array.`;

function mapOpenRouterError(error: unknown): never {
  if (APICallError.isInstance(error)) {
    const status = error.statusCode ?? 500;
    const retryAfter =
      error.responseHeaders instanceof Headers
        ? parseRetryAfterSeconds(error.responseHeaders.get("retry-after"))
        : undefined;

    const errorOptions: {
      message: string;
      status: number;
      url?: string;
      retryAfterSeconds?: number;
      cause?: unknown;
    } = {
      message: error.message ?? "OpenRouter request failed",
      status,
      url: error.url ?? OPENROUTER_URL,
      cause: error,
    };

    if (retryAfter !== undefined) {
      errorOptions.retryAfterSeconds = retryAfter;
    }

    throw new HttpError(errorOptions);
  }

  throw error;
}

export interface ImageExtractionContext {
  nearbyText?: string | undefined;
  altText?: string | undefined;
}

export async function extractEntitiesFromImage(
  imageUrl: string,
  context: ImageExtractionContext | undefined,
  apiKey: string
): Promise<ImageExtractionResult> {
  const openai = createOpenAI({
    apiKey,
    baseURL: OPENROUTER_URL,
  });

  const contextHint =
    context?.nearbyText || context?.altText
      ? `\n\nContext from the page: "${context.nearbyText || context.altText}"`
      : "";

  // Fetch the image first to handle protected URLs and ensure accessibility
  const imageData = await fetchImageAsData(imageUrl);

  try {
    const content: MessageContent = [
      {
        type: "text",
        text: `${EXTRACTION_PROMPT}${contextHint}`,
      },
      {
        type: "image",
        image: imageData,
      },
    ];

    const { object } = await generateObject({
      model: openai(MODEL_ID),
      schema: extractionResponseSchema,
      messages: [
        {
          role: "user",
          content,
        },
      ],
      maxOutputTokens: 1200,
      temperature: 0.2,
    });

    const result: ImageExtractionResult = {
      entities: object.entities as ImageExtractedEntity[],
    };

    if (object.imageDescription) {
      result.imageDescription = object.imageDescription;
    }

    return result;
  } catch (error) {
    mapOpenRouterError(error);
  }
}
