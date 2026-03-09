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

  await saveText(selectedText, tab.url, "");
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

  await saveText(selectedText, tab.url, "");
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

async function appendToDoc(token, docId, text, sourceUrl, tag) {
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
  let headerParts = [];

  if (tag) {
    headerParts.push(`[${tag}]`);
  }
  if (prefs.includeTimestamp) {
    headerParts.push(`Saved on ${new Date().toLocaleString()}`);
  }
  if (prefs.includeUrl) {
    headerParts.push(`🔗 ${sourceUrl}`);
  }

  const header = headerParts.length > 0 ? headerParts.join(" - ") + "\n\n" : "";

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

async function saveText(text, sourceUrl, tag) {
  try {
    const token = await getAuthToken();
    const docId = await getTargetDocId();
    if (!docId) {
      notify("No Google Doc configured. Click the extension icon to set one up.");
      throw new Error("No Google Doc configured.");
    }
    await appendToDoc(token, docId, text, sourceUrl, tag);
    saveToHistory(text, sourceUrl, tag);
    notify("✅ Text saved to Google Docs!");
  } catch (error) {
    console.error("Save to Google Docs failed:", error);
    notify(`❌ Failed to save: ${error.message}`);
    throw error;
  }
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
function saveToHistory(text, url, tag) {
  const entry = {
    text: text.length > 100 ? text.substring(0, 100) + "…" : text,
    url,
    tag: tag || "",
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
        await saveText(request.text, request.url, request.tag);
        sendResponse({ success: true });
      } catch (error) {
        sendResponse({ success: false, error: error.message });
      }
    })();
    return true;
  }

  if (request.type === "TRANSLATE_TEXT") {
    (async () => {
      try {
        const translated = await translateText(request.text, request.targetLang);
        sendResponse({ success: true, translatedText: translated });
      } catch (error) {
        sendResponse({ success: false, error: error.message });
      }
    })();
    return true;
  }
});

// --- Translation via Google Translate ---

async function translateText(text, targetLang) {
  const url =
    "https://translate.googleapis.com/translate_a/single?" +
    new URLSearchParams({
      client: "gtx",
      sl: "auto",
      tl: targetLang,
      dt: "t",
      q: text,
    });

  const response = await fetch(url);
  if (!response.ok) {
    throw new Error("Translation service unavailable");
  }

  const data = await response.json();
  // data[0] is an array of [translatedChunk, originalChunk, ...]
  const translated = data[0].map((segment) => segment[0]).join("");
  if (!translated) throw new Error("No translation returned");
  return translated;
}
