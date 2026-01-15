/**
 * Normalizes entity names for deduplication matching.
 * Converts to lowercase, removes special characters, collapses whitespace.
 */
export function normalizeEntityName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, "")
    .replace(/\s+/g, " ")
    .trim();
}
