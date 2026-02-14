import { z } from "zod";

export const extractedContentSchema = z.object({
  url: z.string().url(),
  title: z.string(),
  content: z.string(),
  contentType: z.string().optional(),
  platformData: z.record(z.unknown()).optional(),
});

export const requestImageSchema = z.object({
  url: z.string().url(),
  altText: z.string().optional(),
  position: z.number().int().min(0),
  nearbyText: z.string().optional(),
  heuristicScore: z.number().min(0).max(1).optional(),
  estimatedType: z.string().optional(),
});

export const createBookmarkSchema = z.object({
  url: z.string().url("Invalid URL format"),
  extractedContent: extractedContentSchema.optional(),
  images: z.array(requestImageSchema).optional(),
});

export const bookmarkIdSchema = z.object({
  id: z.string().uuid("Invalid bookmark ID"),
});

export const searchQuerySchema = z.object({
  query: z.string().min(1, "Query cannot be empty").max(500, "Query too long"),
  limit: z.coerce.number().int().min(1).max(50).default(5),
});

export const userIdSchema = z.object({
  userId: z.string().uuid("Invalid user ID"),
});

export const createTopicSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(500).optional(),
});

export const topicIdSchema = z.object({
  id: z.string().uuid("Invalid topic ID"),
});

export const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export type CreateBookmarkInput = z.infer<typeof createBookmarkSchema>;
export type SearchQueryInput = z.infer<typeof searchQuerySchema>;
export type CreateTopicInput = z.infer<typeof createTopicSchema>;
export type PaginationInput = z.infer<typeof paginationSchema>;
