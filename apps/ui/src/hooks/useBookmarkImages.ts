import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  getBookmarkImages,
  extractImage,
  extractAllImages,
  skipImage,
  type ContentImage,
} from "~/lib/api";

export function useBookmarkImages(bookmarkId: string | null) {
  return useQuery({
    queryKey: ["bookmarkImages", bookmarkId],
    queryFn: async () => {
      if (!bookmarkId) return null;
      const response = await getBookmarkImages(bookmarkId);
      if (!response.success) {
        throw new Error("Failed to fetch images");
      }
      return response.data;
    },
    enabled: !!bookmarkId,
    refetchInterval: (query) => {
      // Refetch while any images are in QUEUED or PROCESSING state
      const data = query.state.data;
      if (!data) return false;
      const hasProcessing = data.images.some(
        (img) => img.status === "QUEUED" || img.status === "PROCESSING"
      );
      return hasProcessing ? 3000 : false;
    },
  });
}

export function useExtractImage(bookmarkId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (imageId: string) => extractImage(bookmarkId, imageId),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["bookmarkImages", bookmarkId],
      });
    },
  });
}

export function useExtractAllImages(bookmarkId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (minScore?: number) => extractAllImages(bookmarkId, minScore),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["bookmarkImages", bookmarkId],
      });
    },
  });
}

export function useSkipImage(bookmarkId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (imageId: string) => skipImage(bookmarkId, imageId),
    onMutate: async (imageId) => {
      await queryClient.cancelQueries({
        queryKey: ["bookmarkImages", bookmarkId],
      });

      const previous = queryClient.getQueryData<{
        bookmarkId: string;
        images: ContentImage[];
        total: number;
      }>(["bookmarkImages", bookmarkId]);

      if (previous) {
        queryClient.setQueryData(["bookmarkImages", bookmarkId], {
          ...previous,
          images: previous.images.map((img) =>
            img.id === imageId ? { ...img, status: "SKIPPED" as const } : img
          ),
        });
      }

      return { previous };
    },
    onError: (_err, _imageId, context) => {
      if (context?.previous) {
        queryClient.setQueryData(
          ["bookmarkImages", bookmarkId],
          context.previous
        );
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({
        queryKey: ["bookmarkImages", bookmarkId],
      });
    },
  });
}

export type { ContentImage };
