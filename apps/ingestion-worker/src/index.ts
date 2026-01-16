/**
 * Ingestion Worker
 *
 * Consumes bookmark-ingestion queue and processes bookmarks:
 * 1. Fetches URL and converts to markdown
 * 2. Generates summary
 * 3. Triggers entity extraction (right after markdown is stored)
 * 4. Creates text chunks
 * 5. Generates embeddings
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
} from "@rag-bookmarks/shared";

async function handleIngestionMessage(
  message: BookmarkIngestionMessage,
  env: Env,
  bookmarkRepo: BookmarkRepository,
  chunkRepo: ChunkRepository
): Promise<void> {
  const { bookmarkId, url, userId } = message;
  console.log(`Processing bookmark ${bookmarkId}: ${url}`);

  try {
    await bookmarkRepo.update({ id: bookmarkId, status: "PROCESSING" });

    // Step 1: Fetch and convert to markdown
    const { title, markdown, metadata } = await fetchAndConvertToMarkdown(url);
    console.log(
      `Bookmark ${bookmarkId}: Extracted title "${title}", markdown length: ${markdown.length}`
    );

    // Step 2: Generate summary
    const llmProvider = createLLMProvider("openrouter", env.OPENROUTER_API_KEY);
    const summary = await generateSummary(markdown, title, llmProvider);
    console.log(
      `Bookmark ${bookmarkId}: Generated summary (${summary.length} chars)`
    );

    // Step 3: Store markdown and summary (entity extraction prereq)
    await bookmarkRepo.update({
      id: bookmarkId,
      title,
      ...(metadata.description && { description: metadata.description }),
      ...(metadata.favicon && { favicon: metadata.favicon }),
      ...(metadata.ogImage && { ogImage: metadata.ogImage }),
      markdown,
      summary,
    });

    // Step 4: Trigger entity extraction EARLY (right after markdown is stored)
    // This allows entity extraction to run in parallel with chunking/embedding
    await env.ENTITY_QUEUE.send({
      type: "entity-extraction",
      bookmarkId,
      userId,
    });
    console.log(`Bookmark ${bookmarkId}: Enqueued entity extraction (early)`);

    // Step 5: Create chunks
    const embeddingProvider = createEmbeddingProvider(
      "jina",
      env.JINA_API_KEY,
      "jina-embeddings-v3",
      "retrieval.passage"
    );

    const textChunks = chunkMarkdown(markdown);
    const chunksWithBreadcrumbs = textChunks.filter(
      (c) => c.breadcrumbPath
    ).length;
    console.log(
      `Bookmark ${bookmarkId}: Created ${textChunks.length} chunks (${chunksWithBreadcrumbs} with breadcrumbs)`
    );

    // Delete existing chunks and create new ones
    await chunkRepo.deleteByBookmarkId(bookmarkId);

    if (textChunks.length > 0) {
      const chunkParams = textChunks.map((chunk) => ({
        bookmarkId,
        content: chunk.content,
        position: chunk.position,
        tokenCount: chunk.tokenCount,
        breadcrumbPath: chunk.breadcrumbPath,
      }));

      const storedChunks = await chunkRepo.createMany(chunkParams);
      console.log(
        `Bookmark ${bookmarkId}: Stored ${storedChunks.length} chunks`
      );

      // Step 6: Generate embeddings
      const chunkContents = storedChunks.map((chunk) => chunk.content);
      console.log(
        `Bookmark ${bookmarkId}: Generating embeddings for ${chunkContents.length} chunks`
      );

      const embeddings = await generateEmbeddings(
        chunkContents,
        embeddingProvider
      );

      // Step 7: Update chunks with embeddings
      for (let i = 0; i < storedChunks.length; i++) {
        const chunk = storedChunks[i];
        const embedding = embeddings[i];
        if (chunk && embedding) {
          await chunkRepo.update({
            id: chunk.id,
            embedding,
          });
        }
      }

      console.log(
        `Bookmark ${bookmarkId}: Stored embeddings for ${embeddings.length} chunks`
      );
    }

    // Step 8: Mark as done
    await bookmarkRepo.update({
      id: bookmarkId,
      status: "DONE",
    });

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

// Export for Cloudflare Workers
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
