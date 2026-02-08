export interface Bookmark {
  id: string;
  url: string;
  title: string | null;
  description: string | null;
  favicon: string | null;
  ogImage: string | null;
  summary: string | null;
  status: "PENDING" | "PROCESSING" | "DONE" | "FAILED";
  createdAt: string;
}

export interface BookmarksResponse {
  success: boolean;
  data: Bookmark[];
}

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

function getCsrfToken(): string | null {
  if (typeof document === "undefined") {
    return null;
  }

  const match = document.cookie
    .split("; ")
    .find((cookie) => cookie.startsWith("csrf_token="));

  if (!match) {
    return null;
  }

  const [, value] = match.split("=");
  return value ? decodeURIComponent(value) : null;
}

async function apiFetch(input: string, init: RequestInit = {}) {
  const method = (init.method ?? "GET").toUpperCase();
  const headers = new Headers(init.headers);

  if (!SAFE_METHODS.has(method)) {
    const csrfToken = getCsrfToken();
    if (csrfToken) {
      headers.set("x-csrf-token", csrfToken);
    }
  }

  return fetch(input, {
    ...init,
    headers,
    credentials: "include",
  });
}

export async function getBookmarks(
  limit = 20,
  offset = 0
): Promise<BookmarksResponse> {
  const response = await apiFetch(
    `/api/v1/bookmarks?limit=${limit}&offset=${offset}`
  );
  if (!response.ok) {
    throw new Error("Failed to fetch bookmarks");
  }
  return response.json();
}

export interface DeleteBookmarkResponse {
  success: boolean;
  error?: { code: string; message: string };
}

export async function deleteBookmark(
  id: string
): Promise<DeleteBookmarkResponse> {
  const response = await apiFetch(`/api/v1/bookmarks/${id}`, {
    method: "DELETE",
  });
  return response.json();
}

export interface SearchResult {
  bookmarkId: string;
  title: string | null;
  url: string;
  snippet: string;
  breadcrumb: string | null;
  score: number;
  favicon?: string | null;
  ogImage?: string | null;
  description?: string | null;
}

export interface SearchResponse {
  success: boolean;
  data: {
    query: string;
    results: SearchResult[];
    totalResults: number;
  };
}

export async function searchBookmarks(
  query: string,
  limit = 20
): Promise<SearchResponse> {
  const response = await apiFetch(
    `/api/v1/search?q=${encodeURIComponent(query)}&limit=${limit}`
  );
  if (!response.ok) {
    throw new Error("Search failed");
  }
  return response.json();
}

// Entity types
export type EntityType = "book" | "movie" | "tv_show";
export type EntityStatus =
  | "PENDING"
  | "CANDIDATES_FOUND"
  | "ENRICHED"
  | "AMBIGUOUS"
  | "FAILED";

export interface BookMetadata {
  canonical_title?: string;
  authors?: string[];
  cover_url?: string;
  year?: number;
  isbn?: string;
  page_count?: number;
  subjects?: string[];
}

export interface MovieMetadata {
  canonical_title?: string;
  directors?: string[];
  poster_url?: string;
  year?: number;
  runtime?: number;
  genres?: string[];
  tmdb_id?: number;
  imdb_id?: string;
}

export interface TvShowMetadata {
  canonical_title?: string;
  creators?: string[];
  poster_url?: string;
  first_air_year?: number;
  seasons?: number;
  genres?: string[];
  tmdb_id?: number;
}

export type EntityMetadata = BookMetadata | MovieMetadata | TvShowMetadata;

export interface Entity {
  id: string;
  type: EntityType;
  name: string;
  status: EntityStatus;
  metadata: EntityMetadata | null;
  bookmarkCount: number;
  createdAt: string;
}

export interface EntitiesResponse {
  success: boolean;
  data: {
    entities: Entity[];
    total: number;
  };
}

export interface EntityBookmark {
  id: string;
  url: string;
  title: string | null;
  summary: string | null;
  favicon: string | null;
  ogImage: string | null;
  contextSnippet: string | null;
  confidence: number;
  createdAt: string;
}

export interface EntityBookmarksResponse {
  success: boolean;
  data: {
    entity: {
      id: string;
      name: string;
      type: EntityType;
    };
    bookmarks: EntityBookmark[];
    total: number;
  };
}

export async function getEntities(
  type?: EntityType,
  limit = 50,
  offset = 0
): Promise<EntitiesResponse> {
  const params = new URLSearchParams({
    limit: limit.toString(),
    offset: offset.toString(),
  });
  if (type) {
    params.set("type", type);
  }

  const response = await apiFetch(`/api/v1/entities?${params}`);
  if (!response.ok) {
    throw new Error("Failed to fetch entities");
  }
  return response.json();
}

export async function getEntityBookmarks(
  entityId: string,
  limit = 20,
  offset = 0
): Promise<EntityBookmarksResponse> {
  const params = new URLSearchParams({
    limit: limit.toString(),
    offset: offset.toString(),
  });

  const response = await apiFetch(
    `/api/v1/entities/${entityId}/bookmarks?${params}`
  );
  if (!response.ok) {
    throw new Error("Failed to fetch entity bookmarks");
  }
  return response.json();
}

// Content Image types
export type ContentImageStatus =
  | "PENDING"
  | "QUEUED"
  | "PROCESSING"
  | "COMPLETED"
  | "SKIPPED"
  | "FAILED";

export interface ImageExtractedEntity {
  type: "book" | "movie" | "tv_show";
  name: string;
  confidence: number;
  hints?: {
    author?: string;
    director?: string;
    year?: number;
  };
}

export interface ImageExtractionResult {
  entities: ImageExtractedEntity[];
  imageDescription?: string;
}

export interface ContentImage {
  id: string;
  url: string;
  altText: string | null;
  position: number;
  status: ContentImageStatus;
  heuristicScore: number | null;
  estimatedType: string | null;
  extractedEntities: ImageExtractionResult | null;
  processedAt: string | null;
  errorMessage: string | null;
}

export interface BookmarkImagesResponse {
  success: boolean;
  data: {
    bookmarkId: string;
    images: ContentImage[];
    total: number;
  };
}

export interface ExtractImageResponse {
  success: boolean;
  data?: { imageId: string; status: string };
  error?: { code: string; message: string };
}

export interface ExtractAllImagesResponse {
  success: boolean;
  data?: { queued: number; imageIds?: string[]; message?: string };
  error?: { code: string; message: string };
}

export async function getBookmarkImages(
  bookmarkId: string
): Promise<BookmarkImagesResponse> {
  const response = await apiFetch(`/api/v1/bookmarks/${bookmarkId}/images`);
  if (!response.ok) {
    throw new Error("Failed to fetch bookmark images");
  }
  return response.json();
}

export async function extractImage(
  bookmarkId: string,
  imageId: string
): Promise<ExtractImageResponse> {
  const response = await apiFetch(
    `/api/v1/bookmarks/${bookmarkId}/images/${imageId}/extract`,
    { method: "POST" }
  );
  return response.json();
}

export async function extractAllImages(
  bookmarkId: string,
  minScore?: number
): Promise<ExtractAllImagesResponse> {
  const response = await apiFetch(
    `/api/v1/bookmarks/${bookmarkId}/images/extract-all`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ minScore }),
    }
  );
  return response.json();
}

export async function skipImage(
  bookmarkId: string,
  imageId: string
): Promise<ExtractImageResponse> {
  const response = await apiFetch(
    `/api/v1/bookmarks/${bookmarkId}/images/${imageId}/skip`,
    { method: "POST" }
  );
  return response.json();
}
