// Cloudflare Worker environment bindings
export interface Env {
  // Environment variables
  ENVIRONMENT: string;
  DATABASE_URL: string;
  OPENROUTER_API_KEY: string;
  JINA_API_KEY: string;
  GOOGLE_CLIENT_ID: string;
  GOOGLE_CLIENT_SECRET: string;
  JWT_SECRET: string;
  SUPABASE_URL: string;
  SUPABASE_ANON_KEY: string;
  TMDB_API_KEY: string;
  AUTH_COOKIE_DOMAIN?: string;
  WEB_ORIGIN?: string;

  // Queue bindings (producer only)
  INGESTION_QUEUE: Queue<BookmarkIngestionMessage>;
  ENTITY_QUEUE: Queue<EntityQueueMessage>;
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

export interface ImageEntityExtractionMessage {
  type: "image-entity-extraction";
  imageId: string;
  bookmarkId: string;
  userId: string;
}

export type EntityQueueMessage = ImageEntityExtractionMessage;

// Auth context
export interface AuthContext {
  userId: string;
  email: string | null;
}

export interface AuthVariables {
  auth: AuthContext;
}

export type AppContext = {
  Bindings: Env;
  Variables: AuthVariables;
};
