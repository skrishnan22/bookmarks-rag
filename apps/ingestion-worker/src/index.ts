/**
 * Ingestion Worker
 *
 * Consumes bookmark-ingestion queue and processes bookmarks through a
 * resumable pipeline:
 * 1. Fetches URL and converts to markdown (PENDING → MARKDOWN_READY)
 * 2. Generates summary and triggers entity extraction (→ CONTENT_READY)
 * 3. Creates text chunks (→ CHUNKS_READY)
 * 4. Generates embeddings (→ DONE)
 *
 * On retry, the worker resumes from the last completed stage based on status.
 */

import pLimit from "p-limit";

import type { Env, BookmarkIngestionMessage } from "./types.js";
import {
  createDb,
  BookmarkRepository,
  ChunkRepository,
  createEmbeddingProvider,
  createLLMProvider,
  fetchAndConvertToMarkdown,
  generateSummary,
  chunkMarkdown,
  generateEmbeddings,
  type Bookmark,
  type Chunk,
  type BookmarkStatus,
  type EmbeddingProvider,
  type LLMProvider,
} from "@rag-bookmarks/shared";

type StepName = "fetch" | "summarize" | "chunk" | "embed";

interface PipelineStage {
  fromStatus: BookmarkStatus;
  toStatus: BookmarkStatus;
  step: StepName;
}

interface PipelineContext {
  bookmarkId: string;
  url: string;
  userId: string;
  env: Env;
  bookmarkRepo: BookmarkRepository;
  chunkRepo: ChunkRepository;
  llmProvider: LLMProvider;
  embeddingProvider: EmbeddingProvider;

  markdown: string | null;
  title: string | null;
  storedChunks: Chunk[];
}

const PIPELINE: PipelineStage[] = [
  { fromStatus: "PENDING", toStatus: "MARKDOWN_READY", step: "fetch" },
  {
    fromStatus: "MARKDOWN_READY",
    toStatus: "CONTENT_READY",
    step: "summarize",
  },
  { fromStatus: "CONTENT_READY", toStatus: "CHUNKS_READY", step: "chunk" },
  { fromStatus: "CHUNKS_READY", toStatus: "DONE", step: "embed" },
];

const stepExecutors: Record<StepName, (ctx: PipelineContext) => Promise<void>> =
  {
    async fetch(ctx: PipelineContext): Promise<void> {
      const { markdown, title, metadata } = await fetchAndConvertToMarkdown(
        ctx.url
      );

      await ctx.bookmarkRepo.update({
        id: ctx.bookmarkId,
        title,
        ...(metadata.description && { description: metadata.description }),
        ...(metadata.favicon && { favicon: metadata.favicon }),
        ...(metadata.ogImage && { ogImage: metadata.ogImage }),
        markdown,
      });

      ctx.markdown = markdown;
      ctx.title = title;

      console.log(
        `Bookmark ${ctx.bookmarkId}: Fetched and stored markdown (${markdown.length} chars)`
      );
    },

    async summarize(ctx: PipelineContext): Promise<void> {
      if (!ctx.markdown || !ctx.title) {
        throw new Error("Missing markdown or title for summarize step");
      }

      const summary = await generateSummary(
        ctx.markdown,
        ctx.title,
        ctx.llmProvider
      );

      await ctx.bookmarkRepo.update({
        id: ctx.bookmarkId,
        summary,
      });

      // Trigger entity extraction (only on fresh completion of this step)
      await ctx.env.ENTITY_QUEUE.send({
        type: "entity-extraction",
        bookmarkId: ctx.bookmarkId,
        userId: ctx.userId,
      });

      console.log(
        `Bookmark ${ctx.bookmarkId}: Generated summary (${summary.length} chars), enqueued entity extraction`
      );
    },

    async chunk(ctx: PipelineContext): Promise<void> {
      if (!ctx.markdown) {
        throw new Error("Missing markdown for chunk step");
      }

      // Delete existing chunks (in case of retry with partial data)
      await ctx.chunkRepo.deleteByBookmarkId(ctx.bookmarkId);

      const textChunks = chunkMarkdown(ctx.markdown);

      if (textChunks.length > 0) {
        const chunkParams = textChunks.map((chunk) => ({
          bookmarkId: ctx.bookmarkId,
          content: chunk.content,
          position: chunk.position,
          tokenCount: chunk.tokenCount,
          breadcrumbPath: chunk.breadcrumbPath,
        }));

        ctx.storedChunks = await ctx.chunkRepo.createMany(chunkParams);
      } else {
        ctx.storedChunks = [];
      }

      console.log(
        `Bookmark ${ctx.bookmarkId}: Created and stored ${ctx.storedChunks.length} chunks`
      );
    },

    /**
     * Generate embeddings for chunks that don't have them
     */
    async embed(ctx: PipelineContext): Promise<void> {
      // Find chunks that need embeddings (supports partial recovery)
      const chunksNeedingEmbeddings = ctx.storedChunks.filter(
        (c) => c.embedding === null
      );

      if (chunksNeedingEmbeddings.length === 0) {
        console.log(
          `Bookmark ${ctx.bookmarkId}: All chunks already have embeddings`
        );
        return;
      }

      const chunkContents = chunksNeedingEmbeddings.map((c) => c.content);

      console.log(
        `Bookmark ${ctx.bookmarkId}: Generating embeddings for ${chunkContents.length} chunks`
      );

      const embeddings = await generateEmbeddings(
        chunkContents,
        ctx.embeddingProvider
      );

      // Update chunks with embeddings
      for (let i = 0; i < chunksNeedingEmbeddings.length; i++) {
        const chunk = chunksNeedingEmbeddings[i];
        const embedding = embeddings[i];
        if (chunk && embedding) {
          await ctx.chunkRepo.update({
            id: chunk.id,
            embedding,
          });
        }
      }

      console.log(
        `Bookmark ${ctx.bookmarkId}: Stored embeddings for ${embeddings.length} chunks`
      );
    },
  };

async function handleIngestionMessage(
  message: BookmarkIngestionMessage,
  env: Env,
  bookmarkRepo: BookmarkRepository,
  chunkRepo: ChunkRepository
): Promise<void> {
  const { bookmarkId, url, userId } = message;
  console.log(`Processing bookmark ${bookmarkId}: ${url}`);

  try {
    const bookmark = await bookmarkRepo.findById(bookmarkId);
    if (!bookmark) {
      console.log(`Bookmark ${bookmarkId} not found, skipping`);
      return;
    }

    if (bookmark.status === "DONE") {
      console.log(`Bookmark ${bookmarkId}: Already complete, skipping`);
      return;
    }

    const existingChunks = await chunkRepo.findByBookmarkId(bookmarkId);

    const ctx: PipelineContext = {
      bookmarkId,
      url,
      userId,
      env,
      bookmarkRepo,
      chunkRepo,
      llmProvider: createLLMProvider("openrouter", env.OPENROUTER_API_KEY),
      embeddingProvider: createEmbeddingProvider(
        "jina",
        env.JINA_API_KEY,
        "jina-embeddings-v3",
        "retrieval.passage"
      ),
      markdown: bookmark.markdown,
      title: bookmark.title,
      storedChunks: existingChunks,
    };

    const startIdx = PIPELINE.findIndex(
      (stage) => stage.fromStatus === bookmark.status
    );
    const actualStartIdx = startIdx >= 0 ? startIdx : 0;

    console.log(
      `Bookmark ${bookmarkId}: Status is ${bookmark.status}, resuming from stage ${actualStartIdx} (${PIPELINE[actualStartIdx]?.step})`
    );

    for (let i = actualStartIdx; i < PIPELINE.length; i++) {
      const stage = PIPELINE[i];
      if (!stage) continue;

      await stepExecutors[stage.step](ctx);
      await bookmarkRepo.update({ id: bookmarkId, status: stage.toStatus });
    }

    console.log(`Bookmark ${bookmarkId} processed successfully`);
  } catch (error) {
    console.error(`Failed to process bookmark ${bookmarkId}:`, error);
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";

    await bookmarkRepo.update({
      id: bookmarkId,
      status: "FAILED",
      errorMessage,
    });
  }
}

export default {
  async queue(
    batch: MessageBatch<BookmarkIngestionMessage>,
    env: Env
  ): Promise<void> {
    console.log(
      `Processing batch of ${batch.messages.length} messages from queue: ${batch.queue}`
    );

    const { db, close } = createDb(env.DATABASE_URL);
    const bookmarkRepo = new BookmarkRepository(db);
    const chunkRepo = new ChunkRepository(db);

    const limit = pLimit(2);

    try {
      await Promise.all(
        batch.messages.map((message) =>
          limit(async () => {
            try {
              await handleIngestionMessage(
                message.body,
                env,
                bookmarkRepo,
                chunkRepo
              );
              message.ack();
            } catch (error) {
              console.error("Failed to process ingestion message:", error);
              message.retry();
            }
          })
        )
      );
    } finally {
      await close();
    }
  },
};
