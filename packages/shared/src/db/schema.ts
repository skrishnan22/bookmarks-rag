import { SQL, sql } from "drizzle-orm";
import {
  pgTable,
  uuid,
  text,
  timestamp,
  uniqueIndex,
  index,
  integer,
  vector,
  customType,
  jsonb,
  real,
  primaryKey,
  boolean,
} from "drizzle-orm/pg-core";

const tsvector = customType<{ data: string }>({
  dataType() {
    return "tsvector";
  },
});

export const users = pgTable(
  "users",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    email: text("email").notNull(),
    googleId: text("google_id").notNull(),
    name: text("name"),
    avatarUrl: text("avatar_url"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
  },
  (table) => [
    uniqueIndex("users_email_idx").on(table.email),
    uniqueIndex("users_google_id_idx").on(table.googleId),
  ]
);

export const bookmarkStatusEnum = [
  "PENDING", // Newly created, waiting for processing
  "MARKDOWN_READY", // URL fetched, markdown stored
  "CONTENT_READY", // Summary generated, entity extraction triggered
  "CHUNKS_READY", // Chunks created and stored
  "DONE", // Embeddings complete
  "FAILED", // Processing failed
] as const;

export type BookmarkStatus = (typeof bookmarkStatusEnum)[number];

export const bookmarks = pgTable(
  "bookmarks",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    url: text("url").notNull(),
    title: text("title"),
    description: text("description"),
    favicon: text("favicon"),
    ogImage: text("og_image"),
    summary: text("summary"),
    markdown: text("markdown"),
    status: text("status").$type<BookmarkStatus>().default("PENDING").notNull(),
    errorMessage: text("error_message"),
    entitiesExtracted: boolean("entities_extracted").default(false).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
  },
  (table) => [
    index("bookmarks_user_id_idx").on(table.userId),
    index("bookmarks_status_idx").on(table.status),
    uniqueIndex("bookmarks_user_url_idx").on(table.userId, table.url),
  ]
);

export const chunks = pgTable(
  "chunks",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    bookmarkId: uuid("bookmark_id")
      .notNull()
      .references(() => bookmarks.id, { onDelete: "cascade" }),
    content: text("content").notNull(),
    context: text("context"),
    contextualizedContent: text("contextualized_content"),
    breadcrumbPath: text("breadcrumb_path"),
    position: integer("position").notNull(),
    tokenCount: integer("token_count"),
    embedding: vector("embedding", { dimensions: 1024 }),
    contentTsv: tsvector("content_tsv").generatedAlwaysAs(
      (): SQL => sql`to_tsvector('english', ${chunks.content})`
    ),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  },
  (table) => [
    index("chunks_bookmark_id_idx").on(table.bookmarkId),
    index("chunks_position_idx").on(table.bookmarkId, table.position),
    index("chunks_content_tsv_idx").using("gin", table.contentTsv),
    index("chunks_embedding_hnsw_idx").using(
      "hnsw",
      table.embedding.op("vector_cosine_ops")
    ),
  ]
);

export const topics = pgTable(
  "topics",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    description: text("description"),
    keywords: jsonb("keywords").$type<string[]>().default([]),
    centroid: vector("centroid", { dimensions: 1024 }),
    isUncategorized: integer("is_uncategorized").default(0).notNull(),
    bookmarkCount: integer("bookmark_count").default(0).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
  },
  (table) => [
    index("topics_user_id_idx").on(table.userId),
    uniqueIndex("topics_user_name_idx").on(table.userId, table.name),
    index("topics_centroid_hnsw_idx").using(
      "hnsw",
      table.centroid.op("vector_cosine_ops")
    ),
  ]
);

export const bookmarkTopics = pgTable(
  "bookmark_topics",
  {
    bookmarkId: uuid("bookmark_id")
      .notNull()
      .references(() => bookmarks.id, { onDelete: "cascade" }),
    topicId: uuid("topic_id")
      .notNull()
      .references(() => topics.id, { onDelete: "cascade" }),
    score: real("score").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  },
  (table) => [
    primaryKey({ columns: [table.bookmarkId, table.topicId] }),
    index("bookmark_topics_bookmark_id_idx").on(table.bookmarkId),
    index("bookmark_topics_topic_id_idx").on(table.topicId),
    index("bookmark_topics_score_idx").on(table.topicId, table.score),
  ]
);

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;

export type Bookmark = typeof bookmarks.$inferSelect;
export type NewBookmark = typeof bookmarks.$inferInsert;

export type Chunk = typeof chunks.$inferSelect;
export type NewChunk = typeof chunks.$inferInsert;

export type Topic = typeof topics.$inferSelect;
export type NewTopic = typeof topics.$inferInsert;

export type BookmarkTopic = typeof bookmarkTopics.$inferSelect;
export type NewBookmarkTopic = typeof bookmarkTopics.$inferInsert;

export const entityTypeEnum = ["book", "movie", "tv_show"] as const;
export type EntityType = (typeof entityTypeEnum)[number];

export const entityStatusEnum = [
  "PENDING",
  "CANDIDATES_FOUND",
  "ENRICHED",
  "AMBIGUOUS",
  "FAILED",
] as const;
export type EntityStatus = (typeof entityStatusEnum)[number];

export interface SearchCandidate {
  externalId: string;
  title: string;
  confidence: number;
  metadata: Record<string, unknown>;
}

export interface SearchCandidates {
  provider: "openlibrary" | "tmdb";
  searchedAt: string;
  results: SearchCandidate[];
}

export interface BookMetadata {
  canonical_title?: string;
  authors?: string[];
  cover_url?: string;
  year?: number;
  isbn?: string;
  openlibrary_key?: string;
  page_count?: number;
  subjects?: string[];
}

export interface MovieMetadata {
  canonical_title?: string;
  directors?: string[];
  poster_url?: string;
  year?: number;
  tmdb_id?: number;
  imdb_id?: string;
  runtime?: number;
  genres?: string[];
}

export interface TvShowMetadata {
  canonical_title?: string;
  creators?: string[];
  poster_url?: string;
  first_air_year?: number;
  tmdb_id?: number;
  seasons?: number;
  genres?: string[];
}

export interface FailedMetadata {
  error: string;
}

export interface AmbiguousMetadata {
  error: string;
  candidates: Array<{
    externalId: string;
    title: string;
  }>;
}

export interface ExtractionHints {
  year: number | null;
  author: string | null; // books
  director: string | null; // movies/tv
  language: string | null;
}

export type EntityMetadata =
  | BookMetadata
  | MovieMetadata
  | TvShowMetadata
  | FailedMetadata
  | AmbiguousMetadata;

export const entities = pgTable(
  "entities",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    type: text("type").$type<EntityType>().notNull(),
    name: text("name").notNull(),
    normalizedName: text("normalized_name").notNull(),
    externalId: text("external_id"),
    status: text("status").$type<EntityStatus>().default("PENDING").notNull(),
    metadata: jsonb("metadata").$type<EntityMetadata>(),
    searchCandidates: jsonb("search_candidates").$type<SearchCandidates>(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
  },
  (table) => [
    index("entities_user_type_idx").on(table.userId, table.type),
    uniqueIndex("entities_user_type_normalized_idx").on(
      table.userId,
      table.type,
      table.normalizedName
    ),
    index("entities_status_idx").on(table.status),
    index("entities_external_id_idx").on(table.externalId),
  ]
);

export const entityBookmarks = pgTable(
  "entity_bookmarks",
  {
    entityId: uuid("entity_id")
      .notNull()
      .references(() => entities.id, { onDelete: "cascade" }),
    bookmarkId: uuid("bookmark_id")
      .notNull()
      .references(() => bookmarks.id, { onDelete: "cascade" }),
    contextSnippet: text("context_snippet"),
    confidence: real("confidence").notNull(),
    extractionHints: jsonb("extraction_hints").$type<ExtractionHints>(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  },
  (table) => [
    primaryKey({ columns: [table.entityId, table.bookmarkId] }),
    index("entity_bookmarks_bookmark_idx").on(table.bookmarkId),
    index("entity_bookmarks_entity_idx").on(table.entityId),
  ]
);

export type Entity = typeof entities.$inferSelect;
export type NewEntity = typeof entities.$inferInsert;

export type EntityBookmark = typeof entityBookmarks.$inferSelect;
export type NewEntityBookmark = typeof entityBookmarks.$inferInsert;
