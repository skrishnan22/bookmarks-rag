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

export async function getBookmarks(
  limit = 20,
  offset = 0
): Promise<BookmarksResponse> {
  const response = await fetch(
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

export async function deleteBookmark(id: string): Promise<DeleteBookmarkResponse> {
  const response = await fetch(`/api/v1/bookmarks/${id}`, { method: "DELETE" });
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
  const response = await fetch(
    `/api/v1/search?q=${encodeURIComponent(query)}&limit=${limit}`
  );
  if (!response.ok) {
    throw new Error("Search failed");
  }
  return response.json();
}

// Entity types
export type EntityType = "book" | "movie" | "tv_show";
export type EntityStatus = "pending" | "enriched" | "ambiguous" | "failed";

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

  const response = await fetch(`/api/v1/entities?${params}`);
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

  const response = await fetch(`/api/v1/entities/${entityId}/bookmarks?${params}`);
  if (!response.ok) {
    throw new Error("Failed to fetch entity bookmarks");
  }
  return response.json();
}
