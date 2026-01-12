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
  TMDB_API_KEY: string;

  // Queue bindings
  INGESTION_QUEUE: Queue<BookmarkIngestionMessage>;
  ENTITY_QUEUE: Queue<EntityExtractionMessage>;
}

// Queue message types
export interface BookmarkIngestionMessage {
  bookmarkId: string;
  url: string;
  userId: string;
}

export interface EntityExtractionMessage {
  bookmarkId: string;
  userId: string;
}

export interface ClusteringMessage {
  userId: string;
}

// Auth context
export interface AuthContext {
  userId: string;
  email: string;
}
