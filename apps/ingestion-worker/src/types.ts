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
  ENTITY_QUEUE: Queue<EntityExtractionMessage>;
}

// Queue message types
export interface BookmarkIngestionMessage {
  bookmarkId: string;
  url: string;
  userId: string;
}

export interface EntityExtractionMessage {
  type: "entity-extraction";
  bookmarkId: string;
  userId: string;
}
