// Cloudflare Worker environment bindings
export interface Env {
  // Environment variables
  ENVIRONMENT: string;
  DATABASE_URL: string;
  OPENROUTER_API_KEY: string;
  COHERE_API_KEY: string;
  GOOGLE_CLIENT_ID: string;
  GOOGLE_CLIENT_SECRET: string;
  JWT_SECRET: string;

  // Service bindings
  // MARKDOWNER: Fetcher;
}

// Auth context
export interface AuthContext {
  userId: string;
  email: string;
}
