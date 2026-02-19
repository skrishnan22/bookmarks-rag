import { DASHBOARD_URL, STORAGE_KEYS } from "./constants";
import { getAuthState, signInWithGoogle, signOut, type AuthState } from "./auth";
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

const authSection = document.getElementById("authSection") as HTMLDivElement;
const mainContent = document.getElementById("mainContent") as HTMLElement;
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

let authState: AuthState = { isAuthenticated: false, user: null, accessToken: null };

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

const GOOGLE_ICON = `<svg viewBox="0 0 24 24"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/></svg>`;

function renderAuth() {
  if (authState.isAuthenticated && authState.user) {
    const avatarUrl = authState.user.user_metadata?.avatar_url ?? '';
    const email = authState.user.email ?? '';
    authSection.innerHTML = `
      <div class="auth-user">
        ${avatarUrl ? `<img class="auth-avatar" src="${avatarUrl}" alt="">` : ''}
        <span class="auth-email">${email}</span>
        <button class="auth-signout" id="signOutBtn">Sign out</button>
      </div>
    `;
    mainContent.classList.remove('main-disabled');
    document.getElementById('signOutBtn')?.addEventListener('click', handleSignOut);
  } else {
    authSection.innerHTML = `
      <button class="auth-signin" id="signInBtn">
        ${GOOGLE_ICON}
        Sign in with Google
      </button>
    `;
    mainContent.classList.add('main-disabled');
    document.getElementById('signInBtn')?.addEventListener('click', handleSignIn);
  }
}

async function handleSignIn() {
  const btn = document.getElementById('signInBtn') as HTMLButtonElement;
  btn.disabled = true;
  btn.innerHTML = 'Signing in...';

  try {
    authState = await signInWithGoogle();
    renderAuth();
  } catch (error) {
    console.error('Sign in failed:', error);
    btn.disabled = false;
    btn.innerHTML = `${GOOGLE_ICON} Sign in with Google`;
  }
}

async function handleSignOut() {
  try {
    await signOut();
    authState = { isAuthenticated: false, user: null, accessToken: null };
    renderAuth();
  } catch (error) {
    console.error('Sign out failed:', error);
  }
}

async function init(): Promise<void> {
  authState = await getAuthState();
  renderAuth();

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
