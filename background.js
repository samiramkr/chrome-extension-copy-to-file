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

async function appendToDoc(token, docId, text, sourceUrl, tag, originalText) {
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
    headerParts.push(`🏷️ ${tag}`);
  }
  if (prefs.includeTimestamp) {
    const now = new Date();
    const time = now.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
      + " · "
      + now.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
    headerParts.push(`📌 ${time}`);
  }
  if (prefs.includeUrl) {
    headerParts.push(`🔗 link`);
  }

  const header = headerParts.length > 0 ? headerParts.join(" - ") + "\n\n" : "";
  const prefix = `${separator}${header}`;

  // Check if this is an edited save with changes
  const hasEdits = originalText && originalText.trim() !== text.trim();

  let bodyText;
  let diffSegments = null;
  if (hasEdits) {
    diffSegments = computeWordDiff(originalText, text);
    bodyText = diffSegments.map((s) => s.text).join("");
  } else {
    bodyText = text;
  }

  const content = `${prefix}${bodyText}\n`;

  const requests = [
    {
      insertText: {
        location: { index: 1 },
        text: content,
      },
    },
  ];

  // Apply hyperlink to "link" word
  if (prefs.includeUrl && sourceUrl) {
    const linkWordIndex = content.indexOf("🔗 link") + "🔗 ".length + 1;
    requests.push({
      updateTextStyle: {
        range: {
          startIndex: linkWordIndex,
          endIndex: linkWordIndex + 4,
        },
        textStyle: {
          link: { url: sourceUrl },
        },
        fields: "link",
      },
    });
  }

  // Apply diff colors if text was edited
  if (hasEdits && diffSegments) {
    const bodyStartIndex = prefix.length + 1; // +1 for doc index
    let offset = 0;
    for (const seg of diffSegments) {
      if (seg.type === "added") {
        requests.push({
          updateTextStyle: {
            range: {
              startIndex: bodyStartIndex + offset,
              endIndex: bodyStartIndex + offset + seg.text.length,
            },
            textStyle: {
              foregroundColor: {
                color: { rgbColor: { red: 0.133, green: 0.545, blue: 0.133 } },
              },
              underline: true,
            },
            fields: "foregroundColor,underline",
          },
        });
      } else if (seg.type === "removed") {
        requests.push({
          updateTextStyle: {
            range: {
              startIndex: bodyStartIndex + offset,
              endIndex: bodyStartIndex + offset + seg.text.length,
            },
            textStyle: {
              foregroundColor: {
                color: { rgbColor: { red: 0.82, green: 0.1, blue: 0.1 } },
              },
              strikethrough: true,
            },
            fields: "foregroundColor,strikethrough",
          },
        });
      }
      offset += seg.text.length;
    }
  }

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

async function saveText(text, sourceUrl, tag, originalText) {
  try {
    const token = await getAuthToken();
    const docId = await getTargetDocId();
    if (!docId) {
      notify("No Google Doc configured. Click the extension icon to set one up.");
      throw new Error("No Google Doc configured.");
    }
    await appendToDoc(token, docId, text, sourceUrl, tag, originalText);
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
        await saveText(request.text, request.url, request.tag, request.originalText);
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

// --- Word-Level Diff ---

function computeWordDiff(oldText, newText) {
  const oldWords = tokenize(oldText);
  const newWords = tokenize(newText);
  const lcs = longestCommonSubsequence(oldWords, newWords);

  const segments = [];
  let oi = 0, ni = 0, li = 0;

  while (oi < oldWords.length || ni < newWords.length) {
    if (li < lcs.length) {
      // Collect removed words (in old but not matching LCS)
      while (oi < oldWords.length && oldWords[oi] !== lcs[li]) {
        segments.push({ type: "removed", text: oldWords[oi] });
        oi++;
      }
      // Collect added words (in new but not matching LCS)
      while (ni < newWords.length && newWords[ni] !== lcs[li]) {
        segments.push({ type: "added", text: newWords[ni] });
        ni++;
      }
      // Common word
      if (li < lcs.length) {
        segments.push({ type: "same", text: lcs[li] });
        oi++;
        ni++;
        li++;
      }
    } else {
      // Remaining old words are removed
      while (oi < oldWords.length) {
        segments.push({ type: "removed", text: oldWords[oi] });
        oi++;
      }
      // Remaining new words are added
      while (ni < newWords.length) {
        segments.push({ type: "added", text: newWords[ni] });
        ni++;
      }
    }
  }

  // Merge consecutive segments of the same type
  const merged = [];
  for (const seg of segments) {
    if (merged.length > 0 && merged[merged.length - 1].type === seg.type) {
      merged[merged.length - 1].text += seg.text;
    } else {
      merged.push({ ...seg });
    }
  }

  return merged;
}

function tokenize(text) {
  // Split into words and whitespace tokens to preserve spacing
  return text.match(/\S+|\s+/g) || [];
}

function longestCommonSubsequence(a, b) {
  const m = a.length, n = b.length;
  // Build LCS length table
  const dp = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] = a[i - 1] === b[j - 1]
        ? dp[i - 1][j - 1] + 1
        : Math.max(dp[i - 1][j], dp[i][j - 1]);
    }
  }
  // Backtrack to get LCS
  const result = [];
  let i = m, j = n;
  while (i > 0 && j > 0) {
    if (a[i - 1] === b[j - 1]) {
      result.unshift(a[i - 1]);
      i--;
      j--;
    } else if (dp[i - 1][j] > dp[i][j - 1]) {
      i--;
    } else {
      j--;
    }
  }
  return result;
}

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
