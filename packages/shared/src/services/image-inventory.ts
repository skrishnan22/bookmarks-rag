import { unified } from "unified";
import remarkParse from "remark-parse";
import remarkGfm from "remark-gfm";
import { visit } from "unist-util-visit";
import type { Root, Image, Paragraph, Text } from "mdast";

export interface ExtractedImage {
  url: string;
  altText?: string | undefined;
  title?: string | undefined;
  nearbyText?: string | undefined;
  position: number;
}

export interface RequestImage {
  url: string;
  altText?: string | undefined;
  position: number;
  nearbyText?: string | undefined;
  heuristicScore?: number | undefined;
  estimatedType?: string | undefined;
}

export interface ImageInventoryInput {
  markdown: string;
  requestImages?: RequestImage[] | undefined;
}

/**
 * Extract images from markdown or use pre-extracted images from request.
 * Prefers request images when available (e.g., from Chrome extension).
 */
export function extractImageInventory(
  input: ImageInventoryInput
): ExtractedImage[] {
  // Prefer request-provided images (from extension/platform extractors)
  if (input.requestImages && input.requestImages.length > 0) {
    return input.requestImages.map((img, index) => ({
      url: img.url,
      altText: img.altText,
      nearbyText: img.nearbyText,
      position: img.position ?? index,
    }));
  }

  // Fall back to markdown extraction
  return extractImagesFromMarkdown(input.markdown);
}

/**
 * Extract images from markdown content using remark parser.
 * Captures alt text and nearby paragraph text for context.
 */
export function extractImagesFromMarkdown(markdown: string): ExtractedImage[] {
  const images: ExtractedImage[] = [];

  const parser = unified().use(remarkParse).use(remarkGfm);
  const tree = parser.parse(markdown) as Root;

  let position = 0;
  let lastParagraphText = "";

  visit(tree, (node) => {
    // Track paragraph text for context
    if (node.type === "paragraph") {
      const paragraphNode = node as Paragraph;
      const textParts: string[] = [];

      visit(paragraphNode, "text", (textNode: Text) => {
        textParts.push(textNode.value);
      });

      const paragraphText = textParts.join(" ").trim();
      if (paragraphText.length > 0) {
        lastParagraphText = paragraphText.slice(0, 500); // Limit context length
      }
    }

    // Extract image nodes
    if (node.type === "image") {
      const imageNode = node as Image;

      // Skip data URIs and invalid URLs
      if (!imageNode.url || imageNode.url.startsWith("data:")) {
        return;
      }

      images.push({
        url: imageNode.url,
        altText: imageNode.alt || undefined,
        title: imageNode.title || undefined,
        nearbyText: lastParagraphText || undefined,
        position: position++,
      });
    }
  });

  return images;
}

/**
 * Extract domain from URL for filtering purposes.
 */
export function extractDomain(url: string): string | undefined {
  try {
    return new URL(url).hostname;
  } catch {
    return undefined;
  }
}
