// User types
export interface User {
  id: string;
  email: string;
  googleId: string;
  name: string | null;
  avatarUrl: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export type BookmarkStatus =
  | "PENDING"
  | "MARKDOWN_READY"
  | "CONTENT_READY"
  | "CHUNKS_READY"
  | "DONE"
  | "FAILED";

export interface Bookmark {
  id: string;
  userId: string;
  url: string;
  title: string | null;
  summary: string | null;
  markdown: string | null;
  status: BookmarkStatus;
  errorMessage: string | null;
  createdAt: Date;
  updatedAt: Date;
}

// Chunk types
export interface Chunk {
  id: string;
  bookmarkId: string;
  content: string;
  context: string | null;
  contextualizedContent: string | null;
  breadcrumbPath: string | null;
  position: number;
  tokenCount: number | null;
  embedding: number[] | null;
  createdAt: Date;
}

// Topic types
export interface Topic {
  id: string;
  userId: string;
  name: string;
  description: string | null;
  createdAt: Date;
}

export interface BookmarkTopic {
  bookmarkId: string;
  topicId: string;
  score: number;
  createdAt: Date;
}

// API Response types
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: ApiError;
}

export interface ApiError {
  code: string;
  message: string;
  details?: unknown;
}

// Search types
export interface SearchResult {
  chunkId: string;
  bookmarkId: string;
  content: string;
  context: string | null;
  breadcrumbPath: string | null;
  score: number;
  bookmark: {
    id: string;
    url: string;
    title: string | null;
    summary: string | null;
  };
}

// Config types
export interface ModelConfig {
  provider: string;
  model: string;
  enabled?: boolean;
}

export interface AppConfig {
  embedding: ModelConfig;
  llm: ModelConfig;
  reranker: ModelConfig & { enabled: boolean };
}
