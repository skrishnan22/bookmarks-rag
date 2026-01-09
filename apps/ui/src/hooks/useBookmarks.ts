import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import {
  getBookmarks,
  searchBookmarks,
  type Bookmark,
  type SearchResult,
} from "~/lib/api";

const PAGE_SIZE = 20;

export function useBookmarks() {
  return useInfiniteQuery({
    queryKey: ["bookmarks"],
    queryFn: async ({ pageParam }) => {
      const response = await getBookmarks(PAGE_SIZE, pageParam);
      if (!response.success) {
        throw new Error("Failed to fetch bookmarks");
      }
      return {
        bookmarks: response.data,
        nextOffset:
          response.data.length === PAGE_SIZE
            ? pageParam + PAGE_SIZE
            : undefined,
      };
    },
    initialPageParam: 0,
    getNextPageParam: (lastPage) => lastPage.nextOffset,
  });
}

export function useSearchBookmarks(query: string, enabled: boolean) {
  return useQuery({
    queryKey: ["search", query],
    queryFn: async () => {
      const response = await searchBookmarks(query, 50);
      if (!response.success) {
        throw new Error("Search failed");
      }
      return response.data.results;
    },
    enabled,
  });
}

export function flattenBookmarks(
  pages: Array<{ bookmarks: Bookmark[]; nextOffset?: number }> | undefined
): Bookmark[] {
  if (!pages) return [];
  return pages.flatMap((page) => page.bookmarks);
}

export type { Bookmark, SearchResult };
