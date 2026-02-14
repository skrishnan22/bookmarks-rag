import type { TwitterExtraction, ExtractedImage } from "./types";

/**
 * Check if a URL is a Twitter/X tweet URL
 */
export function isTwitterUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return (
      (parsed.hostname === "twitter.com" ||
        parsed.hostname === "x.com" ||
        parsed.hostname === "www.twitter.com" ||
        parsed.hostname === "www.x.com") &&
      /\/status\/\d+/.test(parsed.pathname)
    );
  } catch {
    return false;
  }
}

/**
 * Extract tweet ID from URL
 */
export function extractTweetId(url: string): string | null {
  const match = url.match(/\/status\/(\d+)/);
  return match ? match[1] : null;
}

/**
 * Extract tweet data from the current page DOM
 * Must be called from a content script running on Twitter/X
 */
export function extractTweetFromDOM(): TwitterExtraction | null {
  const article = document.querySelector('article[data-testid="tweet"]');
  if (!article) {
    // Try alternate selector for single tweet view
    const altArticle = document.querySelector("article");
    if (!altArticle) return null;
    return extractFromArticle(altArticle);
  }
  return extractFromArticle(article);
}

function extractFromArticle(article: Element): TwitterExtraction | null {
  const url = window.location.href;
  const tweetId = extractTweetId(url);
  if (!tweetId) return null;

  const author = extractAuthor(article);

  const content = extractContent(article);

  const images = extractImages(article);

  const timestamp = extractTimestamp(article);

  const quotedTweet = extractQuotedTweet(article);

  return {
    platform: "twitter",
    tweetId,
    author,
    content,
    images,
    timestamp,
    quotedTweet,
  };
}

function extractAuthor(article: Element): TwitterExtraction["author"] {
  const userNameContainer = article.querySelector('[data-testid="User-Name"]');

  let name = "";
  let handle = "";
  let verified = false;

  if (userNameContainer) {
    const nameSpans = userNameContainer.querySelectorAll("span");
    for (const span of nameSpans) {
      const text = span.textContent?.trim() || "";
      if (
        text &&
        !text.startsWith("@") &&
        !text.includes("·") &&
        text.length > 0
      ) {
        if (span.children.length === 0 || span.querySelector("span") === null) {
          name = text;
          break;
        }
      }
    }

    const handleMatch = userNameContainer.textContent?.match(/@(\w+)/);
    if (handleMatch) {
      handle = handleMatch[1];
    }

    verified =
      !!userNameContainer.querySelector('[data-testid="icon-verified"]') ||
      !!userNameContainer.querySelector('svg[aria-label*="Verified"]') ||
      !!userNameContainer.querySelector('svg[aria-label*="erified"]');
  }

  let avatarUrl: string | undefined;
  const avatarImg = article.querySelector('img[src*="profile_images"]');
  if (avatarImg) {
    avatarUrl = (avatarImg as HTMLImageElement).src;
  }

  return {
    name: name || "Unknown",
    handle: handle || "unknown",
    verified,
    avatarUrl,
  };
}

function extractContent(article: Element): TwitterExtraction["content"] {
  const tweetTextEl = article.querySelector('[data-testid="tweetText"]');

  let text = "";
  let html: string | undefined;

  if (tweetTextEl) {
    text = tweetTextEl.textContent || "";
    html = tweetTextEl.innerHTML;
  } else {
    // Fallback: look for any element with lang attribute (tweet content has lang)
    const langEl = article.querySelector("[lang]");
    if (langEl && langEl.closest('[data-testid="tweet"]') === article) {
      text = langEl.textContent || "";
      html = langEl.innerHTML;
    }
  }

  return {
    text: text.trim(),
    html,
  };
}

function extractImages(article: Element): ExtractedImage[] {
  const images: ExtractedImage[] = [];
  const seenUrls = new Set<string>();

  // Find all images in the tweet
  const imgElements = article.querySelectorAll("img");

  for (const img of imgElements) {
    const src = (img as HTMLImageElement).src || "";

    // Skip if already seen
    if (seenUrls.has(src)) continue;

    // Only include media images from Twitter's CDN
    // Filter out: profile pics, emojis, icons, UI elements
    if (!isMediaImage(src)) continue;

    seenUrls.add(src);

    const alt = (img as HTMLImageElement).alt || undefined;
    const type = determineImageType(src);

    images.push({
      url: src,
      alt,
      type,
    });
  }

  return images;
}

/**
 * Check if URL is a Twitter media image (not avatar, emoji, or UI element)
 */
function isMediaImage(url: string): boolean {
  // Twitter media images come from pbs.twimg.com/media or /ext_tw_video_thumb
  if (url.includes("pbs.twimg.com/media")) return true;
  if (url.includes("pbs.twimg.com/ext_tw_video_thumb")) return true;
  if (url.includes("pbs.twimg.com/tweet_video_thumb")) return true;
  if (url.includes("pbs.twimg.com/amplify_video_thumb")) return true;

  // Filter out known non-media patterns
  if (url.includes("profile_images")) return false;
  if (url.includes("emoji")) return false;
  if (url.includes("abs.twimg.com")) return false; // UI assets
  if (url.includes("pbs.twimg.com/profile_banners")) return false;

  return false;
}

/**
 * Determine the type of image based on URL patterns
 */
function determineImageType(url: string): ExtractedImage["type"] {
  if (url.includes("video_thumb") || url.includes("ext_tw_video")) {
    return "video_thumbnail";
  }
  if (url.includes("tweet_video")) {
    return "gif";
  }
  return "photo";
}

function extractTimestamp(article: Element): string | undefined {
  const timeEl = article.querySelector("time");
  if (timeEl) {
    return timeEl.getAttribute("datetime") || undefined;
  }
  return undefined;
}

function extractQuotedTweet(article: Element): TwitterExtraction | undefined {
  // Quoted tweets are nested within the main tweet
  // They have a specific container with data-testid="quoteTweet"
  const quotedContainer = article.querySelector('[data-testid="quoteTweet"]');
  if (!quotedContainer) return undefined;

  // Extract basic info from quoted tweet
  // Note: This is simplified - quoted tweets have different structure
  const quotedTextEl = quotedContainer.querySelector(
    '[data-testid="tweetText"]'
  );
  const quotedText = quotedTextEl?.textContent || "";

  // Try to extract quoted author
  const quotedUserContainer = quotedContainer.querySelector(
    '[data-testid="User-Name"]'
  );
  let quotedHandle = "";
  let quotedName = "";

  if (quotedUserContainer) {
    const handleMatch = quotedUserContainer.textContent?.match(/@(\w+)/);
    if (handleMatch) {
      quotedHandle = handleMatch[1];
    }
    const nameSpans = quotedUserContainer.querySelectorAll("span");
    for (const span of nameSpans) {
      const text = span.textContent?.trim() || "";
      if (text && !text.startsWith("@") && !text.includes("·")) {
        if (span.children.length === 0) {
          quotedName = text;
          break;
        }
      }
    }
  }

  // Extract images from quoted tweet
  const quotedImages: ExtractedImage[] = [];
  const quotedImgs = quotedContainer.querySelectorAll("img");
  const seenUrls = new Set<string>();

  for (const img of quotedImgs) {
    const src = (img as HTMLImageElement).src;
    if (!seenUrls.has(src) && isMediaImage(src)) {
      seenUrls.add(src);
      quotedImages.push({
        url: src,
        alt: (img as HTMLImageElement).alt || undefined,
        type: determineImageType(src),
      });
    }
  }

  // We can't easily get the quoted tweet ID without additional API calls
  // So we'll use a placeholder
  return {
    platform: "twitter",
    tweetId: "quoted",
    author: {
      name: quotedName || "Unknown",
      handle: quotedHandle || "unknown",
      verified: !!quotedContainer.querySelector('svg[aria-label*="erified"]'),
    },
    content: {
      text: quotedText,
    },
    images: quotedImages,
  };
}

/**
 * Convert Twitter extraction to a bookmark-friendly format
 */
export function twitterExtractionToBookmarkData(
  extraction: TwitterExtraction,
  url: string
): {
  title: string;
  content: string;
  contentType: "tweet";
  platformData: TwitterExtraction;
  images: Array<{
    url: string;
    altText?: string;
    position: number;
    nearbyText?: string;
    heuristicScore: number;
    estimatedType: string;
  }>;
} {
  // Create title from author and content preview
  const contentPreview = extraction.content.text.slice(0, 80);
  const title = `${extraction.author.name} (@${extraction.author.handle}): "${contentPreview}${extraction.content.text.length > 80 ? "..." : ""}"`;

  // Convert to markdown-like content
  const content = tweetToMarkdown(extraction);

  // Convert images to bookmark format with heuristic scores
  // Tweet images get high scores since users intentionally share them
  const images = extraction.images.map((img, index) => ({
    url: img.url,
    altText: img.alt,
    position: index,
    nearbyText: extraction.content.text.slice(0, 200),
    heuristicScore: 0.8, // High score for tweet images
    estimatedType: img.type === "photo" ? "photo" : "video_thumbnail",
  }));

  // Include quoted tweet images if present
  if (extraction.quotedTweet?.images) {
    extraction.quotedTweet.images.forEach((img, index) => {
      images.push({
        url: img.url,
        altText: img.alt,
        position: extraction.images.length + index,
        nearbyText: extraction.quotedTweet?.content.text.slice(0, 200),
        heuristicScore: 0.75, // Slightly lower for quoted content
        estimatedType: img.type === "photo" ? "photo" : "video_thumbnail",
      });
    });
  }

  return {
    title,
    content,
    contentType: "tweet",
    platformData: extraction,
    images,
  };
}

/**
 * Convert tweet extraction to markdown format
 */
function tweetToMarkdown(tweet: TwitterExtraction): string {
  const lines: string[] = [];

  // Author header
  const verifiedBadge = tweet.author.verified ? " [verified]" : "";
  lines.push(
    `## Tweet by ${tweet.author.name} (@${tweet.author.handle})${verifiedBadge}`
  );

  if (tweet.timestamp) {
    const date = new Date(tweet.timestamp);
    lines.push(`*${date.toLocaleString()}*`);
  }
  lines.push("");

  // Content
  lines.push(tweet.content.text);
  lines.push("");

  // Images as markdown
  tweet.images.forEach((img, i) => {
    const altText = img.alt || `Image ${i + 1}`;
    lines.push(`![${altText}](${img.url})`);
  });

  // Quoted tweet if present
  if (tweet.quotedTweet) {
    lines.push("");
    lines.push(
      "> **Quoted tweet from @" + tweet.quotedTweet.author.handle + ":**"
    );
    lines.push("> " + tweet.quotedTweet.content.text.split("\n").join("\n> "));

    tweet.quotedTweet.images.forEach((img, i) => {
      lines.push(`> ![Quoted image ${i + 1}](${img.url})`);
    });
  }

  return lines.join("\n");
}
