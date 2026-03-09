// =============================================================
// background.js — Service Worker for "Save to Google Docs"
// =============================================================
// Responsibilities:
//   1. Register right-click context menu
//   2. Listen for context menu clicks
//   3. Listen for keyboard shortcut (Ctrl+Shift+S / Cmd+Shift+S)
//   4. Get OAuth token via chrome.identity
//   5. Append selected text to Google Doc via Docs API
// =============================================================

// --- Context Menu Setup ---

chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: "save-to-google-docs",
    title: "Save to Google Docs",
    contexts: ["selection"],
  });
});

// --- Context Menu Click Handler ---

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (info.menuItemId !== "save-to-google-docs") return;

  const selectedText = info.selectionText;
  if (!selectedText) {
    notify("No text selected.");
    return;
  }

  await saveText(selectedText, tab.url);
});

// --- Keyboard Shortcut Handler ---

chrome.commands.onCommand.addListener(async (command) => {
  if (command !== "save-selection") return;

  // Get the selected text from the active tab
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab) return;

  const [result] = await chrome.scripting.executeScript({
    target: { tabId: tab.id },
    func: () => window.getSelection().toString(),
  });

  const selectedText = result?.result;
  if (!selectedText) {
    notify("No text selected.");
    return;
  }

  await saveText(selectedText, tab.url);
});

// --- Authentication ---

function getAuthToken() {
  return new Promise((resolve, reject) => {
    chrome.identity.getAuthToken({ interactive: true }, (token) => {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message));
      } else {
        resolve(token);
      }
    });
  });
}

// --- Google Docs API: Append Text ---

async function appendToDoc(token, docId, text, sourceUrl) {
  // Read user preferences (default: both enabled)
  const prefs = await new Promise((resolve) => {
    chrome.storage.sync.get(["includeUrl", "includeTimestamp"], (result) => {
      resolve({
        includeUrl: result.includeUrl !== false,
        includeTimestamp: result.includeTimestamp !== false,
      });
    });
  });

  const separator = "\n———————————————————————————\n";
  let header = "";

  if (prefs.includeTimestamp) {
    header += `📌 Saved on ${new Date().toLocaleString()}\n`;
  }
  if (prefs.includeUrl) {
    header += `🔗 ${sourceUrl}\n`;
  }
  if (header) {
    header += "\n";
  }

  const content = `${separator}${header}${text}\n`;

  const requests = [
    {
      insertText: {
        location: { index: 1 },
        text: content,
      },
    },
  ];

  const response = await fetch(
    `https://docs.googleapis.com/v1/documents/${docId}:batchUpdate`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ requests }),
    }
  );

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error?.message || "Google Docs API error");
  }

  return response.json();
}

// --- Central Save Logic ---

async function saveText(text, sourceUrl) {
  const dest = await getSaveDestination();

  const results = [];

  // Save to Google Docs if destination is "docs" or "both"
  if (dest === "docs" || dest === "both") {
    try {
      const token = await getAuthToken();
      const docId = await getTargetDocId();
      if (!docId) {
        throw new Error("No Google Doc configured. Click the extension icon to set one up.");
      }
      await appendToDoc(token, docId, text, sourceUrl);
      results.push("Google Docs");
    } catch (error) {
      if (dest === "docs") {
        // Docs-only mode: propagate the error
        notify(`❌ Failed to save: ${error.message}`);
        throw error;
      }
      // Both mode: log but continue with local
      console.warn("Google Docs save failed, saved locally:", error.message);
    }
  }

  // Save locally if destination is "local" or "both"
  if (dest === "local" || dest === "both") {
    await saveLocally(text, sourceUrl);
    results.push("local storage");
  }

  saveToHistory(text, sourceUrl);

  if (results.length > 0) {
    notify(`✅ Saved to ${results.join(" & ")}!`);
  }
}

function getSaveDestination() {
  return new Promise((resolve) => {
    chrome.storage.sync.get(["saveDestination"], (result) => {
      resolve(result.saveDestination || "docs");
    });
  });
}

/**
 * Save the full snippet text locally in chrome.storage.local.
 */
function saveLocally(text, url) {
  return new Promise((resolve) => {
    const entry = {
      text,
      url,
      timestamp: new Date().toISOString(),
    };

    chrome.storage.local.get(["localSnippets"], (result) => {
      const snippets = result.localSnippets || [];
      snippets.unshift(entry);
      // Keep last 200 local snippets
      if (snippets.length > 200) snippets.length = 200;
      chrome.storage.local.set({ localSnippets: snippets }, resolve);
    });
  });
}

// --- Storage Helpers ---

function getTargetDocId() {
  return new Promise((resolve) => {
    chrome.storage.sync.get(["targetDocId"], (result) => {
      resolve(result.targetDocId || null);
    });
  });
}

/**
 * Save a snippet to history in chrome.storage.local.
 * Keeps the last 20 entries.
 */
function saveToHistory(text, url) {
  const entry = {
    text: text.length > 100 ? text.substring(0, 100) + "…" : text,
    url,
    timestamp: new Date().toISOString(),
  };

  chrome.storage.local.get(["saveHistory"], (result) => {
    const history = result.saveHistory || [];
    history.unshift(entry);
    // Keep only last 20
    if (history.length > 20) history.length = 20;
    chrome.storage.local.set({ saveHistory: history });
  });
}

// --- Notifications ---

function notify(message) {
  // Send notification to the active tab as a content script message
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    if (tabs[0]) {
      chrome.tabs.sendMessage(tabs[0].id, {
        type: "SHOW_NOTIFICATION",
        message,
      });
    }
  });
}

// --- Message Listener (for popup and content script communication) ---

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.type === "GET_AUTH_TOKEN") {
    getAuthToken()
      .then((token) => sendResponse({ success: true, token }))
      .catch((error) => sendResponse({ success: false, error: error.message }));
    return true; // keep message channel open for async response
  }

  if (request.type === "SAVE_TEXT") {
    (async () => {
      try {
        await saveText(request.text, request.url);
        sendResponse({ success: true });
      } catch (error) {
        sendResponse({ success: false, error: error.message });
      }
    })();
    return true;
  }
});
