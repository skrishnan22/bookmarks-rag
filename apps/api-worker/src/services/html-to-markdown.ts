import { parseHTML } from "linkedom";
import { Readability } from "@mozilla/readability";
import TurndownService from "turndown";

export interface ParseResult {
  title: string;
  markdown: string;
  excerpt: string | undefined;
}

const USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

const FETCH_TIMEOUT_MS = 15000;

export async function fetchAndConvertToMarkdown(
  url: string
): Promise<ParseResult> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      headers: {
        "User-Agent": USER_AGENT,
        Accept:
          "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.5",
      },
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new Error(
        `Fetch failed: ${response.status} ${response.statusText}`
      );
    }

    const contentType = response.headers.get("content-type") || "";
    if (
      !contentType.includes("text/html") &&
      !contentType.includes("text/plain")
    ) {
      throw new Error(`Unsupported content type: ${contentType}`);
    }

    const html = await response.text();
    return convertHtmlToMarkdown(html, url);
  } finally {
    clearTimeout(timeoutId);
  }
}

export function convertHtmlToMarkdown(html: string, url: string): ParseResult {
  const { document } = parseHTML(html);

  let title = "";
  let contentHtml = "";
  let excerpt: string | undefined;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const reader = new Readability(document as any, {
    charThreshold: 100,
  });
  const article = reader.parse();

  if (article && article.content) {
    title = article.title || "";
    contentHtml = article.content;
    excerpt = article.excerpt || undefined;
  } else {
    console.warn(`Readability failed for ${url}, falling back to raw HTML`);
    title = extractTitle(document) || new URL(url).hostname;
    contentHtml = document.body?.innerHTML || html;
  }

  // Parse the content HTML into a DOM node for Turndown
  // Turndown needs a DOM node, not a string, in non-browser environments
  const { document: contentDoc } = parseHTML(contentHtml);

  const turndown = new TurndownService({
    headingStyle: "atx",
    codeBlockStyle: "fenced",
    bulletListMarker: "-",
  });

  turndown.remove(["script", "style", "nav", "footer", "aside"]);

  // Pass the documentElement as linkedom puts parsed content there
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const markdown = turndown.turndown(contentDoc.documentElement as any);

  if (!title) {
    title = extractTitle(document) || new URL(url).hostname;
  }

  return {
    title,
    markdown,
    excerpt,
  };
}

function extractTitle(
  document: ReturnType<typeof parseHTML>["document"]
): string {
  const titleEl = document.querySelector("title");
  if (titleEl?.textContent) {
    return titleEl.textContent.trim();
  }

  const ogTitle = document.querySelector('meta[property="og:title"]');
  if (ogTitle) {
    const content = ogTitle.getAttribute("content");
    if (content) return content.trim();
  }

  const h1 = document.querySelector("h1");
  if (h1?.textContent) {
    return h1.textContent.trim();
  }

  return "";
}
