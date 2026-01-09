import { parseHTML } from "linkedom";
import { Readability } from "@mozilla/readability";
import TurndownService from "turndown";

export interface UrlMetadata {
  title: string;
  description: string | undefined;
  favicon: string | undefined;
  ogImage: string | undefined;
}

export interface ParseResult {
  title: string;
  markdown: string;
  excerpt: string | undefined;
  metadata: UrlMetadata;
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

  const metadata = extractMetadata(document, url);
  metadata.title = title;

  return {
    title,
    markdown,
    excerpt,
    metadata,
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

function extractDescription(
  document: ReturnType<typeof parseHTML>["document"]
): string | undefined {
  const ogDesc = document.querySelector('meta[property="og:description"]');
  if (ogDesc) {
    const content = ogDesc.getAttribute("content");
    if (content) return content.trim();
  }

  const metaDesc = document.querySelector('meta[name="description"]');
  if (metaDesc) {
    const content = metaDesc.getAttribute("content");
    if (content) return content.trim();
  }

  const twitterDesc = document.querySelector(
    'meta[name="twitter:description"]'
  );
  if (twitterDesc) {
    const content = twitterDesc.getAttribute("content");
    if (content) return content.trim();
  }

  return undefined;
}

function extractFavicon(
  document: ReturnType<typeof parseHTML>["document"],
  baseUrl: string
): string | undefined {
  const selectors = [
    'link[rel="icon"]',
    'link[rel="shortcut icon"]',
    'link[rel="apple-touch-icon"]',
    'link[rel="apple-touch-icon-precomposed"]',
  ];

  for (const selector of selectors) {
    const link = document.querySelector(selector);
    if (link) {
      const href = link.getAttribute("href");
      if (href) {
        return resolveUrl(href, baseUrl);
      }
    }
  }

  // Fallback to /favicon.ico
  try {
    const url = new URL(baseUrl);
    return `${url.origin}/favicon.ico`;
  } catch {
    return undefined;
  }
}

function extractOgImage(
  document: ReturnType<typeof parseHTML>["document"],
  baseUrl: string
): string | undefined {
  const selectors = [
    'meta[property="og:image"]',
    'meta[name="twitter:image"]',
    'meta[property="og:image:url"]',
  ];

  for (const selector of selectors) {
    const meta = document.querySelector(selector);
    if (meta) {
      const content = meta.getAttribute("content");
      if (content) {
        return resolveUrl(content, baseUrl);
      }
    }
  }

  return undefined;
}

function resolveUrl(href: string, baseUrl: string): string {
  if (
    href.startsWith("http://") ||
    href.startsWith("https://") ||
    href.startsWith("//")
  ) {
    return href.startsWith("//") ? `https:${href}` : href;
  }
  try {
    return new URL(href, baseUrl).href;
  } catch {
    return href;
  }
}

function extractMetadata(
  document: ReturnType<typeof parseHTML>["document"],
  url: string
): UrlMetadata {
  return {
    title: extractTitle(document),
    description: extractDescription(document),
    favicon: extractFavicon(document, url),
    ogImage: extractOgImage(document, url),
  };
}
