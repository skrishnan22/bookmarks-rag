import { encode } from "gpt-tokenizer";
import { unified } from "unified";
import remarkParse from "remark-parse";
import remarkGfm from "remark-gfm";
import { toString } from "mdast-util-to-string";
import type { Root, RootContent, Heading, TableCell } from "mdast";

/**
 * Creating own chunking logic because existing solutions like Langchain have simple markdown chunking logic.
 * We need to be able to handle complex markdown with tables and code blocks.
 * Langchain's MarkdownTextSplitter is a simple regex-based approach that will break on complex markdown. And only uses
 * headers as semantic boundaries.
 *
 * We use a AST parser to extract section. And then use our own chunking logic to split the sections into chunks.
 * Keeping semantic blocks like tables and code blocks together.
 */

export interface ChunkingConfig {
  maxTokens: number;
  overlapTokens: number;
}

export interface TextChunk {
  content: string;
  position: number;
  tokenCount: number;
  breadcrumbPath: string;
}

export const DEFAULT_CHUNKING_CONFIG: ChunkingConfig = {
  maxTokens: 500,
  overlapTokens: 125,
};

interface MarkdownSection {
  heading: string;
  level: number;
  contentBlocks: ContentBlock[];
  breadcrumb: string;
}

interface ContentBlock {
  type: "atomic" | "splittable";
  content: string;
}

export function countTokens(text: string): number {
  return encode(text).length;
}

/**
 * Creates a markdown parser that understands GitHub Flavored Markdown (GFM).
 *
 * The unified ecosystem works like a pipeline:
 * 1. unified() - Creates the processor
 * 2. use(remarkParse) - Adds markdown parsing capability
 * 3. use(remarkGfm) - Adds GFM support (tables, strikethrough, etc.)
 *
 * The result is a parser that converts markdown string → AST (Abstract Syntax Tree).
 */
function createMarkdownParser() {
  return unified().use(remarkParse).use(remarkGfm);
}

function isAtomicNode(nodeType: string): boolean {
  const atomicTypes = new Set(["table", "code", "html"]);
  return atomicTypes.has(nodeType);
}

function nodeToString(node: RootContent): string {
  if (node.type === "table") {
    return tableToString(node);
  }
  return toString(node);
}

function tableToString(
  tableNode: Extract<RootContent, { type: "table" }>
): string {
  const rows: string[] = [];

  for (let i = 0; i < tableNode.children.length; i++) {
    const row = tableNode.children[i];
    if (!row) continue;

    const cells = row.children.map((cell: TableCell) => toString(cell).trim());
    const prefix = i === 0 ? "Table:" : "Row:";
    rows.push(`${prefix} ${cells.join(" | ")}`);
  }

  return rows.join("\n");
}

/**
 * Extracts sections from markdown using AST parsing.
 *
 * ## Breadcrumb Stack Concept:
 * As we encounter headings, we maintain a stack of parent headings.
 * When we see a heading of level N, we pop all headings with level >= N
 * (they're no longer parents), then push the new heading.
 *
 * Example walkthrough:
 * ```
 * # Article (level 1)     → stack: [Article]           → breadcrumb: "Article"
 * ## Intro (level 2)      → stack: [Article, Intro]    → breadcrumb: "Article > Intro"
 * ### Details (level 3)   → stack: [Article, Intro, Details] → "Article > Intro > Details"
 * ## Methods (level 2)    → pop Intro & Details, push Methods
 *                         → stack: [Article, Methods]  → breadcrumb: "Article > Methods"
 * ```
 */
function parseMarkdownSections(markdown: string): MarkdownSection[] {
  const parser = createMarkdownParser();
  const tree = parser.parse(markdown) as Root;

  const sections: MarkdownSection[] = [];
  const headingStack: { text: string; depth: number }[] = [];

  let currentSection: MarkdownSection | null = null;

  for (const node of tree.children) {
    if (node.type === "heading") {
      if (currentSection && currentSection.contentBlocks.length > 0) {
        sections.push(currentSection);
      }

      const headingText = toString(node);
      const depth = (node as Heading).depth;

      while (
        headingStack.length > 0 &&
        headingStack[headingStack.length - 1]!.depth >= depth
      ) {
        headingStack.pop();
      }

      headingStack.push({ text: headingText, depth });

      const breadcrumb = headingStack.map((h) => h.text).join(" > ");

      currentSection = {
        heading: headingText,
        level: depth,
        contentBlocks: [],
        breadcrumb,
      };
    } else {
      if (!currentSection) {
        currentSection = {
          heading: "",
          level: 0,
          contentBlocks: [],
          breadcrumb: "",
        };
      }

      const content = nodeToString(node).trim();
      if (content) {
        currentSection.contentBlocks.push({
          type: isAtomicNode(node.type) ? "atomic" : "splittable",
          content,
        });
      }
    }
  }

  if (currentSection && currentSection.contentBlocks.length > 0) {
    sections.push(currentSection);
  }

  return sections;
}

function splitIntoParagraphs(text: string): string[] {
  return text
    .split(/\n\n+/)
    .map((p) => p.trim())
    .filter((p) => p.length > 0);
}

/**
 * Splits text into sentences using punctuation boundaries.
 *
 * The regex `(?<=[.!?])\s+` uses a lookbehind assertion:
 * - Split AFTER a sentence-ending punctuation (.!?)
 * - Only when followed by whitespace
 *
 * This is our fallback when paragraphs are too large.
 */
function splitIntoSentences(text: string): string[] {
  const sentences = text.split(/(?<=[.!?])\s+/);
  return sentences.map((s) => s.trim()).filter((s) => s.length > 0);
}

/**
 * Merges small text pieces until they reach the target token count.
 * 1. Iterate through pieces
 * 2. If a piece alone exceeds maxTokens, push it as-is (will be split later)
 * 3. Otherwise, accumulate pieces until adding another would exceed maxTokens
 * 4. When limit reached, save current accumulation and start fresh
 *
 * Small chunks (single sentences, short paragraphs) don't provide enough
 * context for good embeddings. We merge them to reach our target size
 * while respecting semantic boundaries.
 *
 * @param pieces - Array of text pieces to merge
 * @param maxTokens - Maximum tokens per merged chunk
 * @param separator - String to join pieces (default: paragraph break)
 */
function mergeToTargetSize(
  pieces: string[],
  maxTokens: number,
  separator: string = "\n\n"
): string[] {
  const merged: string[] = [];
  let current = "";
  let currentTokens = 0;

  for (const piece of pieces) {
    const pieceTokens = countTokens(piece);

    if (pieceTokens > maxTokens) {
      if (current) {
        merged.push(current);
        current = "";
        currentTokens = 0;
      }
      merged.push(piece);
      continue;
    }

    const separatorTokens = current ? countTokens(separator) : 0;
    const newTokens = currentTokens + pieceTokens + separatorTokens;

    if (newTokens <= maxTokens) {
      current = current ? current + separator + piece : piece;
      currentTokens = newTokens;
    } else {
      if (current) {
        merged.push(current);
      }
      current = piece;
      currentTokens = pieceTokens;
    }
  }

  if (current) {
    merged.push(current);
  }

  return merged;
}

function splitLargeBlock(text: string, maxTokens: number): string[] {
  const sentences = splitIntoSentences(text);
  return mergeToTargetSize(sentences, maxTokens, " ");
}

// ============================================================================
// OVERLAP LOGIC
// ============================================================================

/**
 * Adds overlap between consecutive chunks.
 *
 * When we split text into chunks, important context can be lost at boundaries.
 * By repeating the end of chunk N at the start of chunk N+1, we ensure that:
 * - Concepts spanning chunk boundaries are captured in at least one chunk
 * - Search queries have a better chance of matching relevant context
 *
 *
 * 1. First chunk stays as-is
 * 2. For each subsequent chunk:
 *    a. Take sentences from the END of previous chunk
 *    b. Accumulate until we have ~overlapTokens worth
 *    c. Prepend this overlap to the current chunk
 *
 * ## Sentence-aware overlap:
 *
 * We overlap by whole sentences rather than characters because:
 * - Partial sentences are confusing and hurt embedding quality
 * - Sentences are meaningful semantic units
 */
function addOverlap(chunks: string[], overlapTokens: number): string[] {
  if (chunks.length <= 1 || overlapTokens <= 0) {
    return chunks;
  }

  const result: string[] = [];
  const firstChunk = chunks[0];
  if (firstChunk) {
    result.push(firstChunk);
  }

  for (let i = 1; i < chunks.length; i++) {
    const prevChunk = chunks[i - 1];
    const currentChunk = chunks[i];

    if (!prevChunk || !currentChunk) continue;

    // Extract sentences from previous chunk
    const prevSentences = splitIntoSentences(prevChunk);
    let overlapText = "";
    let overlapCount = 0;

    for (
      let j = prevSentences.length - 1;
      j >= 0 && overlapCount < overlapTokens;
      j--
    ) {
      const sentence = prevSentences[j];
      if (!sentence) continue;

      const sentenceTokens = countTokens(sentence);

      if (overlapCount + sentenceTokens <= overlapTokens * 1.5) {
        overlapText = sentence + " " + overlapText;
        overlapCount += sentenceTokens;
      } else if (overlapCount === 0) {
        overlapText = sentence + " ";
        break;
      } else {
        break;
      }
    }

    result.push(overlapText.trim() + "\n\n" + currentChunk);
  }

  return result;
}

/**
 * ## Strategy (priority order):
 *
 * 1. **Sections** (by headings) - Highest semantic boundary
 *    - Each heading starts a new section with its own breadcrumb
 *
 * 2. **Atomic blocks** (tables, code) - Never split
 *    - These become their own chunks, even if over maxTokens
 *
 * 3. **Paragraphs** - Primary text boundary
 *    - Merge paragraphs until we hit maxTokens
 *
 * 4. **Sentences** - Fallback for large paragraphs
 *    - Only used when a single paragraph exceeds maxTokens
 
 */
export function chunkMarkdown(
  markdown: string,
  config: ChunkingConfig = DEFAULT_CHUNKING_CONFIG
): TextChunk[] {
  const { maxTokens, overlapTokens } = config;

  const sections = parseMarkdownSections(markdown);

  const rawChunks: { content: string; breadcrumb: string }[] = [];

  for (const section of sections) {
    const breadcrumb = section.breadcrumb;

    for (const block of section.contentBlocks) {
      if (block.type === "atomic") {
        rawChunks.push({ content: block.content, breadcrumb });
      } else {
        const paragraphs = splitIntoParagraphs(block.content);

        if (paragraphs.length === 0) continue;

        const merged = mergeToTargetSize(paragraphs, maxTokens);

        for (const chunk of merged) {
          if (countTokens(chunk) > maxTokens) {
            const subChunks = splitLargeBlock(chunk, maxTokens);
            for (const subChunk of subChunks) {
              rawChunks.push({ content: subChunk, breadcrumb });
            }
          } else {
            rawChunks.push({ content: chunk, breadcrumb });
          }
        }
      }
    }
  }

  const contents = rawChunks.map((c) => c.content);
  const overlappedContents = addOverlap(contents, overlapTokens);

  const chunks: TextChunk[] = overlappedContents.map((content, index) => {
    const rawChunk = rawChunks[index];
    return {
      content,
      position: index,
      tokenCount: countTokens(content),
      breadcrumbPath: rawChunk?.breadcrumb ?? "",
    };
  });

  return chunks;
}
