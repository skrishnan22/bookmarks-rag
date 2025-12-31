// Cloudflare Worker environment bindings
export interface Env {
  // Environment variables
  ENVIRONMENT: string;
  DATABASE_URL: string;
  MARKDOWNER_URL: string;
  OPENROUTER_API_KEY: string;
  COHERE_API_KEY: string;
  GOOGLE_CLIENT_ID: string;
  GOOGLE_CLIENT_SECRET: string;
  JWT_SECRET: string;

  // Queue bindings
  INGESTION_QUEUE: Queue<BookmarkIngestionMessage>;

  // Service bindings (production)
  // MARKDOWNER: Fetcher;
}

// Queue message types
export interface BookmarkIngestionMessage {
  bookmarkId: string;
  url: string;
  userId: string;
}

// Auth context
export interface AuthContext {
  userId: string;
  email: string;
}
