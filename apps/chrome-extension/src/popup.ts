import { API_BASE_URL, DASHBOARD_URL, STORAGE_KEYS } from './constants';

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

// DOM Elements
const pageTitle = document.getElementById('pageTitle') as HTMLParagraphElement;
const pageUrl = document.getElementById('pageUrl') as HTMLParagraphElement;
const addCurrentBtn = document.getElementById('addCurrentBtn') as HTMLButtonElement;
const statusEl = document.getElementById('status') as HTMLDivElement;
const autoSyncToggle = document.getElementById('autoSyncToggle') as HTMLInputElement;
const openDashboard = document.getElementById('openDashboard') as HTMLAnchorElement;

// Initialize popup
async function init(): Promise<void> {
  // Load current tab info
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (tab) {
    pageTitle.textContent = tab.title || 'Untitled';
    pageUrl.textContent = tab.url || '';
    pageUrl.title = tab.url || '';
  }

  // Load settings
  const result = await chrome.storage.sync.get({ [STORAGE_KEYS.AUTO_SYNC]: false });
  autoSyncToggle.checked = result[STORAGE_KEYS.AUTO_SYNC];
}

// Add bookmark to API
async function addBookmark(url: string): Promise<{ status: number; data: ApiResponse }> {
  const response = await fetch(`${API_BASE_URL}/bookmarks`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ url }),
  });

  const data: ApiResponse = await response.json();
  return { status: response.status, data };
}

// Show status message
function showStatus(message: string, type: 'success' | 'error' | 'exists'): void {
  statusEl.textContent = message;
  statusEl.className = `status ${type}`;
}

// Handle add current page
addCurrentBtn.addEventListener('click', async () => {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.url) return;

  addCurrentBtn.disabled = true;
  addCurrentBtn.textContent = 'Adding...';
  statusEl.className = 'status';

  try {
    const { status, data } = await addBookmark(tab.url);

    if (status === 202) {
      showStatus('Bookmark added successfully!', 'success');
    } else if (status === 409) {
      showStatus('Already in your bookmarks', 'exists');
    } else {
      showStatus(data.error?.message || 'Failed to add bookmark', 'error');
    }
  } catch (error) {
    console.error('Error adding bookmark:', error);
    showStatus('Failed to connect to server', 'error');
  } finally {
    addCurrentBtn.disabled = false;
    addCurrentBtn.textContent = 'Add to Bookmarks';
  }
});

// Handle auto-sync toggle
autoSyncToggle.addEventListener('change', async (e) => {
  const target = e.target as HTMLInputElement;
  const autoSync = target.checked;
  await chrome.storage.sync.set({ [STORAGE_KEYS.AUTO_SYNC]: autoSync });

  // Notify background script
  chrome.runtime.sendMessage({ type: 'AUTO_SYNC_CHANGED', autoSync });
});

// Handle open dashboard
openDashboard.addEventListener('click', (e) => {
  e.preventDefault();
  chrome.tabs.create({ url: DASHBOARD_URL });
});

// Initialize
init();
