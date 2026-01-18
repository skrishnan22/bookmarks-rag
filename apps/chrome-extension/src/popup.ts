import { DASHBOARD_URL, STORAGE_KEYS } from "./constants";
import type { BookmarkContentData } from "./extractors/types";

interface ApiResponse {
  success: boolean;
  data?: {
    id: string;
    url: string;
    status: string;
  };
  error?: {
    code: string;
    message: string;
    bookmarkId?: string;
  };
}

interface BackgroundResponse {
  status: number;
  data: ApiResponse;
}

const pageTitle = document.getElementById("pageTitle") as HTMLParagraphElement;
const pageUrl = document.getElementById("pageUrl") as HTMLParagraphElement;
const addCurrentBtn = document.getElementById(
  "addCurrentBtn"
) as HTMLButtonElement;
const statusEl = document.getElementById("status") as HTMLDivElement;
const autoSyncToggle = document.getElementById(
  "autoSyncToggle"
) as HTMLInputElement;
const openDashboard = document.getElementById(
  "openDashboard"
) as HTMLAnchorElement;

/**
 * Check if URL is a Twitter/X tweet URL
 */
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

/**
 * Try to extract content from the tab using content script
 */
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

async function init(): Promise<void> {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (tab) {
    pageTitle.textContent = tab.title || "Untitled";
    pageUrl.textContent = tab.url || "";
    pageUrl.title = tab.url || "";

    if (tab.url && isTwitterUrl(tab.url)) {
      pageTitle.textContent = `🐦 ${tab.title || "Tweet"}`;
    }
  }

  const result = await chrome.storage.sync.get({
    [STORAGE_KEYS.AUTO_SYNC]: false,
  });
  autoSyncToggle.checked = result[STORAGE_KEYS.AUTO_SYNC];
}

async function addBookmark(
  url: string,
  extractedContent?: BookmarkContentData | null
): Promise<BackgroundResponse> {
  return chrome.runtime.sendMessage({
    type: "ADD_BOOKMARK",
    url,
    extractedContent,
  });
}

function showStatus(
  message: string,
  type: "success" | "error" | "exists"
): void {
  statusEl.textContent = message;
  statusEl.className = `status ${type}`;
}

addCurrentBtn.addEventListener("click", async () => {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.url) return;

  addCurrentBtn.disabled = true;
  addCurrentBtn.textContent = "Adding...";
  statusEl.className = "status";

  try {
    let extractedContent: BookmarkContentData | null = null;

    if (isTwitterUrl(tab.url) && tab.id) {
      addCurrentBtn.textContent = "Extracting...";
      console.log("Attempting to extract from tab:", tab.id, tab.url);

      try {
        extractedContent = await extractContentFromTab(tab.id);
        console.log("Extraction result:", extractedContent);

        if (extractedContent) {
          console.log("Extracted Twitter content:", extractedContent.title);
          console.log("Images found:", extractedContent.images.length);
        } else {
          console.warn(
            "No content extracted - is the content script loaded? Refresh the Twitter page."
          );
        }
      } catch (err) {
        console.error("Extraction error:", err);
      }
    }

    addCurrentBtn.textContent = "Saving...";
    const { status, data } = await addBookmark(tab.url, extractedContent);

    if (status === 202) {
      const imageCount = extractedContent?.images.length || 0;
      const message =
        imageCount > 0
          ? `Added with ${imageCount} image${imageCount > 1 ? "s" : ""}!`
          : "Bookmark added successfully!";
      showStatus(message, "success");
    } else if (status === 409) {
      showStatus("Already in your bookmarks", "exists");
    } else {
      showStatus(data.error?.message || "Failed to add bookmark", "error");
    }
  } catch (error) {
    console.error("Error adding bookmark:", error);
    showStatus("Failed to connect to server", "error");
  } finally {
    addCurrentBtn.disabled = false;
    addCurrentBtn.textContent = "Add to Bookmarks";
  }
});

autoSyncToggle.addEventListener("change", async (e) => {
  const target = e.target as HTMLInputElement;
  const autoSync = target.checked;
  await chrome.storage.sync.set({ [STORAGE_KEYS.AUTO_SYNC]: autoSync });

  // Notify background script
  chrome.runtime.sendMessage({ type: "AUTO_SYNC_CHANGED", autoSync });
});

// Handle open dashboard
openDashboard.addEventListener("click", (e) => {
  e.preventDefault();
  chrome.tabs.create({ url: DASHBOARD_URL });
});

// Initialize
init();
