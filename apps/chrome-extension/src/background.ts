import { API_BASE_URL, STORAGE_KEYS } from "./constants";

// State
let autoSyncEnabled = false;

// Initialize on install/startup
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

// Listen for messages from popup
chrome.runtime.onMessage.addListener(
  (message: { type: string; autoSync?: boolean }) => {
    if (message.type === "AUTO_SYNC_CHANGED") {
      autoSyncEnabled = message.autoSync ?? false;
      console.log("Auto-sync changed:", autoSyncEnabled);
    }
  }
);

// Listen for bookmark created events
chrome.bookmarks.onCreated.addListener(
  async (_id: string, bookmark: chrome.bookmarks.BookmarkTreeNode) => {
    if (!autoSyncEnabled) return;
    if (!bookmark.url) return; // Skip folders

    console.log("New bookmark detected:", bookmark.url);

    try {
      const response = await fetch(`${API_BASE_URL}/bookmarks`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ url: bookmark.url }),
      });

      const data = await response.json();

      if (response.status === 202) {
        console.log("Bookmark synced successfully:", bookmark.url);
      } else if (response.status === 409) {
        console.log("Bookmark already exists:", bookmark.url);
      } else {
        console.error("Failed to sync bookmark:", data.error);
      }
    } catch (error) {
      console.error("Error syncing bookmark:", error);
    }
  }
);
