import { z } from "zod";

// Bookmark schemas
export const createBookmarkSchema = z.object({
  url: z.string().url("Invalid URL format"),
});

export const bookmarkIdSchema = z.object({
  id: z.string().uuid("Invalid bookmark ID"),
});

// Search schemas
export const searchQuerySchema = z.object({
  query: z.string().min(1, "Query cannot be empty").max(500, "Query too long"),
  limit: z.coerce.number().int().min(1).max(50).default(5),
});

// User schemas
export const userIdSchema = z.object({
  userId: z.string().uuid("Invalid user ID"),
});

// Topic schemas
export const createTopicSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(500).optional(),
});

export const topicIdSchema = z.object({
  id: z.string().uuid("Invalid topic ID"),
});

// Pagination schemas
export const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

// Type exports from schemas
export type CreateBookmarkInput = z.infer<typeof createBookmarkSchema>;
export type SearchQueryInput = z.infer<typeof searchQuerySchema>;
export type CreateTopicInput = z.infer<typeof createTopicSchema>;
export type PaginationInput = z.infer<typeof paginationSchema>;
