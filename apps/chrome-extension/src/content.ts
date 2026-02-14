/**
 * Content script for extracting data from web pages
 * Runs in the context of the page and can access the DOM
 */

import {
  isTwitterUrl,
  extractTweetFromDOM,
  twitterExtractionToBookmarkData,
} from './extractors/twitter';
import type { BookmarkContentData } from './extractors/types';

// Message types
interface ExtractContentRequest {
  type: 'EXTRACT_CONTENT';
}

interface ExtractContentResponse {
  success: boolean;
  data?: BookmarkContentData;
  error?: string;
}

/**
 * Extract content from the current page
 */
function extractPageContent(): BookmarkContentData | null {
  const url = window.location.href;

  // Twitter/X extraction
  if (isTwitterUrl(url)) {
    const tweetData = extractTweetFromDOM();

    if (tweetData) {
      const bookmarkData = twitterExtractionToBookmarkData(tweetData, url);

      return {
        url,
        ...bookmarkData,
      };
    }
  }

  // Default extraction for non-Twitter pages
  // Return null to signal the server should handle extraction
  return null;
}

// Listen for messages from background script
chrome.runtime.onMessage.addListener(
  (
    message: ExtractContentRequest,
    _sender: chrome.runtime.MessageSender,
    sendResponse: (response: ExtractContentResponse) => void
  ) => {
    if (message.type === 'EXTRACT_CONTENT') {
      try {
        const data = extractPageContent();

        if (data) {
          sendResponse({ success: true, data });
        } else {
          // No special extraction needed - let server handle it
          sendResponse({
            success: true,
            data: undefined,
          });
        }
      } catch (error) {
        console.error('Content extraction error:', error);
        sendResponse({
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }

    // Return true to indicate we'll send response asynchronously
    return true;
  }
);

// Log that content script is loaded (for debugging)
console.log('[Wefts] Content script loaded for:', window.location.href);
