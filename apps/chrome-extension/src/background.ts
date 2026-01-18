import { API_BASE_URL, STORAGE_KEYS } from "./constants";
import type { BookmarkContentData } from "./extractors/types";

let autoSyncEnabled = false;

chrome.runtime.onInstalled.addListener(async () => {
  const result = await chrome.storage.sync.get({
    [STORAGE_KEYS.AUTO_SYNC]: false,
  });
  autoSyncEnabled = result[STORAGE_KEYS.AUTO_SYNC];
  console.log("Wefts extension installed, autoSync:", autoSyncEnabled);
});

chrome.runtime.onStartup.addListener(async () => {
  const result = await chrome.storage.sync.get({
    [STORAGE_KEYS.AUTO_SYNC]: false,
  });
  autoSyncEnabled = result[STORAGE_KEYS.AUTO_SYNC];
});

interface AddBookmarkMessage {
  type: "ADD_BOOKMARK";
  url: string;
  extractedContent?: BookmarkContentData | null;
}

interface AutoSyncMessage {
  type: "AUTO_SYNC_CHANGED";
  autoSync: boolean;
}

type ExtensionMessage = AddBookmarkMessage | AutoSyncMessage;

chrome.runtime.onMessage.addListener(
  (
    message: ExtensionMessage,
    _sender: chrome.runtime.MessageSender,
    sendResponse: (response: { status: number; data: unknown }) => void
  ) => {
    if (message.type === "AUTO_SYNC_CHANGED") {
      autoSyncEnabled = message.autoSync ?? false;
      console.log("Auto-sync changed:", autoSyncEnabled);
      return false;
    }

    if (message.type === "ADD_BOOKMARK") {
      console.log("ADD_BOOKMARK received:", {
        url: message.url,
        hasExtractedContent: !!message.extractedContent,
        imageCount: message.extractedContent?.images?.length ?? 0,
      });
      sendBookmarkToApi(message.url, message.extractedContent)
        .then((result) => sendResponse(result))
        .catch((error) => {
          console.error("API error:", error);
          sendResponse({
            status: 500,
            data: { error: { message: "Failed to connect to server" } },
          });
        });
      return true;
    }

    return false;
  }
);

function isTwitterUrl(url: string): boolean {
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

async function extractContentFromTab(
  tabId: number
): Promise<BookmarkContentData | null> {
  try {
    const response = await chrome.tabs.sendMessage(tabId, {
      type: "EXTRACT_CONTENT",
    });

    if (response?.success && response.data) {
      return response.data;
    }
    return null;
  } catch (error) {
    console.log("Content extraction not available:", error);
    return null;
  }
}

/**
 * Send bookmark to API with optional extracted content
 */
async function sendBookmarkToApi(
  url: string,
  extractedContent?: BookmarkContentData | null
): Promise<{ status: number; data: unknown }> {
  const body: Record<string, unknown> = { url };

  if (extractedContent) {
    body.extractedContent = extractedContent;
  }

  const response = await fetch(`${API_BASE_URL}/bookmarks`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  const data = await response.json();
  return { status: response.status, data };
}

chrome.bookmarks.onCreated.addListener(
  async (_id: string, bookmark: chrome.bookmarks.BookmarkTreeNode) => {
    if (!autoSyncEnabled) return;
    if (!bookmark.url) return; // Skip folders

    console.log("New bookmark detected:", bookmark.url);

    try {
      let extractedContent: BookmarkContentData | null = null;

      // For Twitter URLs, try to extract content from the active tab
      if (isTwitterUrl(bookmark.url)) {
        const [activeTab] = await chrome.tabs.query({
          active: true,
          currentWindow: true,
        });

        if (activeTab?.id && activeTab.url === bookmark.url) {
          extractedContent = await extractContentFromTab(activeTab.id);
          if (extractedContent) {
            console.log("Extracted Twitter content:", extractedContent.title);
          }
        }
      }

      const { status, data } = await sendBookmarkToApi(
        bookmark.url,
        extractedContent
      );

      if (status === 202) {
        console.log("Bookmark synced successfully:", bookmark.url);
      } else if (status === 409) {
        console.log("Bookmark already exists:", bookmark.url);
      } else {
        console.error("Failed to sync bookmark:", data);
      }
    } catch (error) {
      console.error("Error syncing bookmark:", error);
    }
  }
);

// Export for use by popup
export { extractContentFromTab, sendBookmarkToApi, isTwitterUrl };
