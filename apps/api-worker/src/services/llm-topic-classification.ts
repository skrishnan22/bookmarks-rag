import type { LLMProvider } from "@rag-bookmarks/shared";

/**
 * Minimal bookmark data needed for classification
 */
export interface BookmarkForClassification {
  id: string;
  title: string | null;
  url: string;
  description: string | null;
  summary: string | null;
}

/**
 * Minimal topic data needed for classification
 */
export interface TopicForClassification {
  id: string;
  name: string;
}

export interface ClassificationResult {
  topicName: string;
  existingTopicId: string | null;
  isNew: boolean;
}

/**
 * Classify a bookmark using LLM, with awareness of existing topics.
 * The LLM will either reuse an existing topic or suggest a new one.
 */
export async function classifyBookmarkWithLLM(
  bookmark: BookmarkForClassification,
  existingTopics: TopicForClassification[],
  llmProvider: LLMProvider
): Promise<ClassificationResult> {
  const topicListText =
    existingTopics.length > 0
      ? existingTopics.map((t) => `- ${t.name}`).join("\n")
      : "(none yet - you will create the first topic)";

  // Build a concise representation of the bookmark
  const bookmarkText = buildBookmarkText(bookmark);

  const prompt = `You are categorizing a bookmark into topics.

EXISTING TOPICS:
${topicListText}

BOOKMARK:
${bookmarkText}

RULES:
1. If this bookmark fits an EXISTING topic, reply with EXACTLY that topic name (case-sensitive)
2. If no existing topic fits well, suggest a NEW topic (1-3 words, domain-specific)
3. Prefer reusing existing topics when the bookmark is reasonably related
4. Focus on the DOMAIN or SUBJECT MATTER, not the content type
5. Use specific domain names like: "System Design", "Machine Learning", "Product Management", "Databases"
6. NEVER use generic terms like: "Learning", "Resources", "Articles", "Development", "Skills", "Guides", "Tutorials"

Reply with ONLY the topic name, nothing else.`;

  try {
    const response = await llmProvider.complete(prompt, {
      maxTokens: 20,
      temperature: 0.3,
    });

    const suggestedName = normalizeTopicName(response);

    // Check if it matches an existing topic (exact match, case-insensitive)
    const existingMatch = existingTopics.find(
      (t) => t.name.toLowerCase() === suggestedName.toLowerCase()
    );

    if (existingMatch) {
      return {
        topicName: existingMatch.name, // Use exact case from existing
        existingTopicId: existingMatch.id,
        isNew: false,
      };
    }

    // Validate the new topic name
    if (!isValidTopicName(suggestedName)) {
      console.warn(
        `Invalid topic name suggested: "${suggestedName}", using fallback`
      );
      return {
        topicName: "Miscellaneous",
        existingTopicId: null,
        isNew: true,
      };
    }

    return {
      topicName: suggestedName,
      existingTopicId: null,
      isNew: true,
    };
  } catch (error) {
    console.error("LLM topic classification failed:", error);
    // Fallback to generic topic
    return {
      topicName: "Miscellaneous",
      existingTopicId: null,
      isNew: true,
    };
  }
}

/**
 * Build a concise text representation of a bookmark for classification
 */
function buildBookmarkText(bookmark: BookmarkForClassification): string {
  const parts: string[] = [];

  if (bookmark.title) {
    parts.push(`Title: ${bookmark.title}`);
  }

  parts.push(`URL: ${bookmark.url}`);

  if (bookmark.description) {
    parts.push(`Description: ${bookmark.description}`);
  } else if (bookmark.summary) {
    // Use summary if no description
    const truncatedSummary =
      bookmark.summary.length > 200
        ? bookmark.summary.slice(0, 200) + "..."
        : bookmark.summary;
    parts.push(`Summary: ${truncatedSummary}`);
  }

  return parts.join("\n");
}

/**
 * Normalize topic name from LLM response
 */
function normalizeTopicName(name: string): string {
  return (
    name
      .trim()
      // Remove quotes
      .replace(/^["'`]+|["'`]+$/g, "")
      // Remove "Topic:" prefix if present
      .replace(/^Topic:\s*/i, "")
      // Normalize whitespace
      .replace(/\s+/g, " ")
      .trim()
  );
}

/**
 * Validate that a topic name is acceptable
 */
function isValidTopicName(name: string): boolean {
  if (name.length === 0 || name.length > 50) {
    return false;
  }

  if (name.includes("\n")) {
    return false;
  }

  const words = name.split(/\s+/);
  if (words.length < 1 || words.length > 4) {
    return false;
  }

  // Check for disallowed generic terms
  const DISALLOWED_WORDS = new Set([
    "learning",
    "learn",
    "resources",
    "resource",
    "articles",
    "article",
    "development",
    "develop",
    "skills",
    "skill",
    "guides",
    "guide",
    "tutorials",
    "tutorial",
    "tips",
    "links",
  ]);

  const lowerWords = words.map((w) => w.toLowerCase());
  const hasDisallowed = lowerWords.some((w) => DISALLOWED_WORDS.has(w));

  return !hasDisallowed;
}

/**
 * Batch classify multiple bookmarks.
 * Processes bookmarks sequentially to avoid rate limits and maintain topic consistency.
 */
export async function classifyBookmarksBatch(
  bookmarks: BookmarkForClassification[],
  existingTopics: TopicForClassification[],
  llmProvider: LLMProvider,
  onProgress?: (processed: number, total: number) => void
): Promise<Map<string, ClassificationResult>> {
  const results = new Map<string, ClassificationResult>();
  const currentTopics = [...existingTopics];

  for (let i = 0; i < bookmarks.length; i++) {
    const bookmark = bookmarks[i];
    if (!bookmark) continue;

    const result = await classifyBookmarkWithLLM(
      bookmark,
      currentTopics,
      llmProvider
    );

    results.set(bookmark.id, result);

    // If a new topic was created, add it to the list for subsequent classifications
    if (result.isNew && result.topicName !== "Miscellaneous") {
      currentTopics.push({
        id: `pending-${i}`, // Placeholder ID, will be replaced when actually created
        name: result.topicName,
      });
    }

    if (onProgress) {
      onProgress(i + 1, bookmarks.length);
    }
  }

  return results;
}
