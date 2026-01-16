import { encode } from "gpt-tokenizer";
import { unified } from "unified";
import remarkParse from "remark-parse";
import remarkGfm from "remark-gfm";
import { toString } from "mdast-util-to-string";
import type { Root, RootContent, TableCell } from "mdast";

export interface ChunkingConfig {
  maxTokens: number;
  overlapTokens: number;
  hardMaxTokens: number;
  minTokensForOverlap: number;
}

export interface TextChunk {
  content: string;
  position: number;
  tokenCount: number;
  breadcrumbPath: string;
}

export const DEFAULT_CHUNKING_CONFIG: ChunkingConfig = {
  maxTokens: 500,
  overlapTokens: 100,
  hardMaxTokens: 550,
  minTokensForOverlap: 250,
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

interface RawChunk {
  content: string;
  breadcrumb: string;
  sectionId: number;
}

export function countTokens(text: string): number {
  return encode(text).length;
}

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
      const depth = node.depth;  // TypeScript narrows to Heading from type check

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

function splitIntoSentences(text: string): string[] {
  const sentences = text.split(/(?<=[.!?])\s+/);
  return sentences.map((s) => s.trim()).filter((s) => s.length > 0);
}

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

interface OverlapConfig {
  overlapTokens: number;
  hardMaxTokens: number;
  minTokensForOverlap: number;
}

function extractOverlapFromChunk(
  content: string,
  overlapTokens: number
): string {
  const sentences = splitIntoSentences(content);
  let overlapText = "";
  let overlapCount = 0;

  for (
    let j = sentences.length - 1;
    j >= 0 && overlapCount < overlapTokens;
    j--
  ) {
    const sentence = sentences[j];
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

  return overlapText.trim();
}

function trimOverlapToFit(
  overlapText: string,
  mainContent: string,
  hardMaxTokens: number
): string {
  const mainTokens = countTokens(mainContent);
  const separatorTokens = countTokens("\n\n");

  let sentences = splitIntoSentences(overlapText);
  let trimmedOverlap = overlapText;

  while (sentences.length > 0) {
    const overlapTokens = countTokens(trimmedOverlap);
    const totalTokens = overlapTokens + separatorTokens + mainTokens;

    if (totalTokens <= hardMaxTokens) {
      return trimmedOverlap;
    }

    sentences.shift();
    trimmedOverlap = sentences.join(" ");
  }

  return "";
}

function addOverlap(chunks: RawChunk[], config: OverlapConfig): RawChunk[] {
  const { overlapTokens, hardMaxTokens, minTokensForOverlap } = config;

  if (chunks.length === 0 || overlapTokens <= 0) {
    return chunks;
  }

  const result: RawChunk[] = [];
  const firstChunk = chunks[0];
  if (firstChunk) {
    result.push({ ...firstChunk });
  }

  const sectionFirstChunkIndex = new Map<number, number>();
  sectionFirstChunkIndex.set(firstChunk?.sectionId ?? 0, 0);

  for (let i = 1; i < chunks.length; i++) {
    const prevChunk = chunks[i - 1];
    const currentChunk = chunks[i];

    if (!prevChunk || !currentChunk) continue;

    const isFirstInSection = !sectionFirstChunkIndex.has(
      currentChunk.sectionId
    );
    if (isFirstInSection) {
      sectionFirstChunkIndex.set(currentChunk.sectionId, i);
    }

    const currentTokens = countTokens(currentChunk.content);
    const isSameSection = prevChunk.sectionId === currentChunk.sectionId;
    const isTooShort = currentTokens < minTokensForOverlap;

    if (!isSameSection || isFirstInSection || isTooShort) {
      result.push({ ...currentChunk });
      continue;
    }

    let overlapText = extractOverlapFromChunk(prevChunk.content, overlapTokens);

    if (overlapText) {
      overlapText = trimOverlapToFit(
        overlapText,
        currentChunk.content,
        hardMaxTokens
      );
    }

    const newContent = overlapText
      ? overlapText + "\n\n" + currentChunk.content
      : currentChunk.content;

    result.push({
      ...currentChunk,
      content: newContent,
    });
  }

  return result;
}

export function chunkMarkdown(
  markdown: string,
  config: ChunkingConfig = DEFAULT_CHUNKING_CONFIG
): TextChunk[] {
  const { maxTokens, overlapTokens, hardMaxTokens, minTokensForOverlap } =
    config;

  const sections = parseMarkdownSections(markdown);

  const rawChunks: RawChunk[] = [];
  let sectionId = 0;

  for (const section of sections) {
    const breadcrumb = section.breadcrumb;
    sectionId++;

    for (const block of section.contentBlocks) {
      if (block.type === "atomic") {
        rawChunks.push({ content: block.content, breadcrumb, sectionId });
      } else {
        const paragraphs = splitIntoParagraphs(block.content);

        if (paragraphs.length === 0) continue;

        const merged = mergeToTargetSize(paragraphs, maxTokens);

        for (const chunk of merged) {
          if (countTokens(chunk) > maxTokens) {
            const subChunks = splitLargeBlock(chunk, maxTokens);
            for (const subChunk of subChunks) {
              rawChunks.push({ content: subChunk, breadcrumb, sectionId });
            }
          } else {
            rawChunks.push({ content: chunk, breadcrumb, sectionId });
          }
        }
      }
    }
  }

  const overlappedChunks = addOverlap(rawChunks, {
    overlapTokens,
    hardMaxTokens,
    minTokensForOverlap,
  });

  const chunks: TextChunk[] = overlappedChunks.map((chunk, index) => {
    const breadcrumbHeader = chunk.breadcrumb
      ? `Section: ${chunk.breadcrumb}\n\n`
      : "";
    const contentWithHeader = breadcrumbHeader + chunk.content;

    return {
      content: contentWithHeader,
      position: index,
      tokenCount: countTokens(contentWithHeader),
      breadcrumbPath: chunk.breadcrumb,
    };
  });

  return chunks;
}
