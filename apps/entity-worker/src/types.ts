// Cloudflare Worker environment bindings
export interface Env {
  ENVIRONMENT: string;
  DATABASE_URL: string;
  OPENROUTER_API_KEY: string;
  TMDB_API_KEY: string;
  ENTITY_QUEUE: Queue<EntityQueueMessage>;
}

// Queue message types
export interface EntityExtractionMessage {
  type: "entity-extraction";
  bookmarkId: string;
  userId: string;
}

export interface EntityEnrichmentMessage {
  type: "entity-enrichment";
  userId: string;
  bookmarkId: string;
}

// Image entity extraction message (one per image)
export interface ImageEntityExtractionMessage {
  type: "image-entity-extraction";
  imageId: string;
  bookmarkId: string;
  userId: string;
}

export type EntityQueueMessage =
  | EntityExtractionMessage
  | EntityEnrichmentMessage
  | ImageEntityExtractionMessage;
