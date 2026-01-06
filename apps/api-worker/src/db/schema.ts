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
    googleId: text("google_id").notNull(), //TODO=>not null. if we provide diff auth?
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
  "PENDING",
  "PROCESSING",
  "DONE",
  "FAILED",
] as const;

export type BookmarkStatus = (typeof bookmarkStatusEnum)[number];

/**
 * Bookmarks table
 * Stores bookmark metadata and extracted content
 */
export const bookmarks = pgTable(
  "bookmarks",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }), //TODO=> What is this?
    url: text("url").notNull(),
    title: text("title"),
    summary: text("summary"),
    markdown: text("markdown"),
    status: text("status").$type<BookmarkStatus>().default("PENDING").notNull(),
    errorMessage: text("error_message"),
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

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;

export type Bookmark = typeof bookmarks.$inferSelect;
export type NewBookmark = typeof bookmarks.$inferInsert;

export type Chunk = typeof chunks.$inferSelect;
export type NewChunk = typeof chunks.$inferInsert;
