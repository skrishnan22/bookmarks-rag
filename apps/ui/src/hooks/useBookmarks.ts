import {
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import {
  getBookmarks,
  searchBookmarks,
  deleteBookmark,
  createBookmark,
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

export function useDeleteBookmark() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: deleteBookmark,
    retry: 2,
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 5000),
    onMutate: async (id: string) => {
      // Cancel any outgoing refetches
      await queryClient.cancelQueries({ queryKey: ["bookmarks"] });
      await queryClient.cancelQueries({ queryKey: ["search"] });

      // Snapshot the previous value
      const previousBookmarks = queryClient.getQueryData<{
        pages: Array<{ bookmarks: Bookmark[]; nextOffset?: number }>;
        pageParams: number[];
      }>(["bookmarks"]);

      // Optimistically remove from bookmarks list
      if (previousBookmarks) {
        queryClient.setQueryData(["bookmarks"], {
          ...previousBookmarks,
          pages: previousBookmarks.pages.map((page) => ({
            ...page,
            bookmarks: page.bookmarks.filter((b) => b.id !== id),
          })),
        });
      }

      return { previousBookmarks };
    },
    onError: (_err, _id, context) => {
      // Rollback on error
      if (context?.previousBookmarks) {
        queryClient.setQueryData(["bookmarks"], context.previousBookmarks);
      }
    },
    onSettled: () => {
      // Invalidate to refetch
      queryClient.invalidateQueries({ queryKey: ["bookmarks"] });
      queryClient.invalidateQueries({ queryKey: ["search"] });
    },
  });
}

export function useCreateBookmark() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: createBookmark,
    retry: 2,
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 5000),
    onSuccess: () => {
      // Invalidate and refetch bookmarks list
      queryClient.invalidateQueries({ queryKey: ["bookmarks"] });
    },
  });
}

export type { Bookmark, SearchResult };
