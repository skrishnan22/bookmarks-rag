// Cloudflare Worker environment bindings
export interface Env {
  ENVIRONMENT: string;
  DATABASE_URL: string;
  OPENROUTER_API_KEY: string;
  JINA_API_KEY: string;
  QUEUE_CONCURRENCY?: string;
  RETRY_BASE_DELAY_SECONDS?: string;
  RETRY_MAX_DELAY_SECONDS?: string;

  // Queue bindings
  ENTITY_QUEUE: Queue<EntityExtractionMessage | ImageEntityExtractionMessage>;
}

// Queue message types
export interface BookmarkIngestionMessage {
  bookmarkId: string;
  url: string;
  userId: string;
  // Optional pre-extracted content from extension (skips markdown extraction when present)
  extractedContent?: {
    title: string;
    content: string;
    contentType?: string;
    platformData?: Record<string, unknown>;
  };
  // Optional images from extension (skips markdown image extraction when present)
  extractedImages?: Array<{
    url: string;
    altText?: string;
    position: number;
    nearbyText?: string;
    heuristicScore?: number;
    estimatedType?: string;
  }>;
}

export interface EntityExtractionMessage {
  type: "entity-extraction";
  bookmarkId: string;
  userId: string;
}

export interface ImageEntityExtractionMessage {
  type: "image-entity-extraction";
  imageId: string;
  bookmarkId: string;
  userId: string;
}
