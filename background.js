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

  try {
    const token = await getAuthToken();
    const docId = await getTargetDocId();

    if (!docId) {
      notify("No Google Doc configured. Click the extension icon to set one up.");
      return;
    }

    await appendToDoc(token, docId, selectedText, tab.url);
    saveToHistory(selectedText, tab.url);
    notify("✅ Text saved to Google Docs!");
  } catch (error) {
    console.error("Save to Google Docs failed:", error);
    notify(`❌ Failed to save: ${error.message}`);
  }
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

  try {
    const token = await getAuthToken();
    const docId = await getTargetDocId();

    if (!docId) {
      notify("No Google Doc configured. Click the extension icon to set one up.");
      return;
    }

    await appendToDoc(token, docId, selectedText, tab.url);
    notify("✅ Text saved to Google Docs!");
    saveToHistory(selectedText, tab.url);
  } catch (error) {
    console.error("Save to Google Docs failed:", error);
    notify(`❌ Failed to save: ${error.message}`);
  }
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
  const timestamp = new Date().toLocaleString();
  const separator = "\n———————————————————————————\n";
  const header = `📌 Saved on ${timestamp}\n🔗 ${sourceUrl}\n\n`;
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
        const token = await getAuthToken();
        const docId = await getTargetDocId();
        if (!docId) {
          sendResponse({ success: false, error: "No target doc configured." });
          return;
        }
        await appendToDoc(token, docId, request.text, request.url);
        saveToHistory(request.text, request.url);
        sendResponse({ success: true });
      } catch (error) {
        sendResponse({ success: false, error: error.message });
      }
    })();
    return true;
  }
});
