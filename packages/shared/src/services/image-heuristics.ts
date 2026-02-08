import type { ExtractedImage } from "./image-inventory.js";
import { extractDomain } from "./image-inventory.js";

export interface HeuristicResult {
  score: number; // 0-1, higher = more likely to contain entities
  estimatedType: string; // 'cover', 'photo', 'icon', 'decorative', 'unknown'
  reasons: string[]; // debugging/transparency
}

// Domains that typically don't contain entity content
const SKIP_DOMAINS = [
  "gravatar.com",
  "githubusercontent.com", // avatars
  "googleusercontent.com",
  "wp.com/latex", // equations
  "shields.io", // badges
  "badge.fury.io",
  "img.shields.io",
  "travis-ci.org",
  "circleci.com",
  "codecov.io",
];

// File extensions that vision models cannot process
const SKIP_EXTENSIONS = [".svg", ".svgz", ".eps", ".ai", ".pdf"];

// Domains known for entity-related images
const ENTITY_SUGGESTIVE_DOMAINS = [
  "amazon.com",
  "m.media-amazon.com", // book covers
  "goodreads.com",
  "image.tmdb.org", // movie/tv posters
  "imdb.com",
  "letterboxd.com",
  "openlibrary.org",
  "covers.openlibrary.org",
  "ia.media-imdb.com",
];

// Platform domains that boost score (social media shares)
const PLATFORM_BOOST_DOMAINS: Record<string, number> = {
  "pbs.twimg.com": 0.25, // Twitter images
  "cdn.bsky.app": 0.25, // Bluesky
  "scontent.cdninstagram.com": 0.2,
};

// Keywords suggesting entity content
const ENTITY_KEYWORDS = [
  "cover",
  "poster",
  "book",
  "movie",
  "film",
  "dvd",
  "blu-ray",
  "novel",
  "author",
  "director",
  "series",
  "season",
  "album",
];

export interface HeuristicContext {
  platform?: string;
  contentType?: string;
}

/**
 * Calculate heuristic score for an image to estimate likelihood of containing entities.
 */
export function calculateHeuristicScore(
  image: ExtractedImage,
  context?: HeuristicContext
): HeuristicResult {
  const reasons: string[] = [];
  let score = 0.3; // baseline score

  const domain = extractDomain(image.url);
  const urlLower = image.url.toLowerCase();

  // Skip unsupported file types (SVG, etc.) - vision models can't process these
  const urlPath = urlLower.split("?")[0] || urlLower; // Remove query params
  if (SKIP_EXTENSIONS.some((ext) => urlPath.endsWith(ext))) {
    return {
      score: 0,
      estimatedType: "vector",
      reasons: ["unsupported format (vector/non-raster)"],
    };
  }

  // Domain-based skip (return early for decorative domains)
  if (domain && SKIP_DOMAINS.some((d) => domain.includes(d))) {
    return { score: 0, estimatedType: "decorative", reasons: ["skip domain"] };
  }

  // Entity-suggestive domain boost
  if (domain && ENTITY_SUGGESTIVE_DOMAINS.some((d) => domain.includes(d))) {
    score += 0.4;
    reasons.push(`entity domain: ${domain}`);
  }

  // Platform-specific boosts
  if (domain) {
    for (const [platformDomain, boost] of Object.entries(
      PLATFORM_BOOST_DOMAINS
    )) {
      if (domain.includes(platformDomain)) {
        score += boost;
        reasons.push(`platform boost: ${platformDomain}`);
        break;
      }
    }
  }

  // Alt text analysis
  const altLower = (image.altText || "").toLowerCase();
  const hasEntityKeywordInAlt = ENTITY_KEYWORDS.some((kw) =>
    altLower.includes(kw)
  );
  if (hasEntityKeywordInAlt) {
    score += 0.2;
    reasons.push("entity keyword in alt");
  }

  // Nearby text analysis
  const nearbyLower = (image.nearbyText || "").toLowerCase();
  const hasEntityKeywordNearby = ENTITY_KEYWORDS.some((kw) =>
    nearbyLower.includes(kw)
  );
  if (hasEntityKeywordNearby) {
    score += 0.15;
    reasons.push("entity keyword in nearby text");
  }

  // URL pattern analysis
  if (urlLower.includes("cover") || urlLower.includes("poster")) {
    score += 0.2;
    reasons.push("cover/poster in URL");
  }

  // Thumbnail/small image penalty
  if (/\d{2,3}x\d{2,3}/.test(image.url) || urlLower.includes("thumb")) {
    score -= 0.2;
    reasons.push("likely thumbnail");
  }

  // Icon/favicon penalty
  if (urlLower.includes("favicon") || urlLower.includes("icon")) {
    score -= 0.3;
    reasons.push("likely icon");
  }

  // Content type boost (e.g., tweets)
  if (context?.contentType === "tweet") {
    score += 0.15;
    reasons.push("tweet content type");
  }

  // Estimate type based on score and signals
  let estimatedType = "unknown";
  if (score >= 0.6) {
    estimatedType = "cover";
  } else if (score <= 0.1) {
    estimatedType = "decorative";
  } else if (altLower.includes("photo") || altLower.includes("headshot")) {
    estimatedType = "photo";
  } else if (urlLower.includes("icon") || urlLower.includes("favicon")) {
    estimatedType = "icon";
  }

  // Clamp score to 0-1 range
  score = Math.max(0, Math.min(1, score));

  return {
    score,
    estimatedType,
    reasons,
  };
}
