import pLimit from "p-limit";
import type { EmbeddingProvider } from "../providers/index.js";

const EMBEDDING_BATCH_SIZE = 100;
const MAX_CONCURRENCY = 5;

export async function generateEmbeddings(
  texts: string[],
  provider: EmbeddingProvider
): Promise<number[][]> {
  if (texts.length === 0) {
    return [];
  }

  if (texts.length <= EMBEDDING_BATCH_SIZE) {
    return provider.embedBatch(texts);
  }

  const batches: string[][] = [];
  for (let i = 0; i < texts.length; i += EMBEDDING_BATCH_SIZE) {
    batches.push(texts.slice(i, i + EMBEDDING_BATCH_SIZE));
  }

  const limit = pLimit(MAX_CONCURRENCY);
  const batchResults = await Promise.all(
    batches.map((batch) => limit(() => provider.embedBatch(batch)))
  );

  return batchResults.flat();
}

export async function generateEmbedding(
  text: string,
  provider: EmbeddingProvider
): Promise<number[]> {
  return provider.embed(text);
}
