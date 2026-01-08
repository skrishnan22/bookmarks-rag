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
