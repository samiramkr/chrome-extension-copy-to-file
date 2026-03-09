// =============================================================
// popup.js — Popup Logic for "Save to Google Docs"
// =============================================================
// Responsibilities:
//   1. Handle Google OAuth sign-in / sign-out
//   2. Connect or create a target Google Doc
//   3. Update UI based on auth and doc state
// =============================================================

// --- DOM Elements ---

const authSection = document.getElementById("auth-section");
const authStatus = document.getElementById("auth-status");
const authBtn = document.getElementById("auth-btn");

const connectedSection = document.getElementById("connected-section");
const docInfo = document.getElementById("doc-info");
const docTitle = document.getElementById("doc-title");
const docLink = document.getElementById("doc-link");

const docInput = document.getElementById("doc-input");
const saveDocBtn = document.getElementById("save-doc-btn");

const newDocTitle = document.getElementById("new-doc-title");
const createDocBtn = document.getElementById("create-doc-btn");

const signoutBtn = document.getElementById("signout-btn");
const messageEl = document.getElementById("message");

const historyList = document.getElementById("history-list");
const clearHistoryBtn = document.getElementById("clear-history-btn");

const toggleUrl = document.getElementById("toggle-url");
const toggleTimestamp = document.getElementById("toggle-timestamp");

const shortcutKeys = document.getElementById("shortcut-keys");
const changeShortcutLink = document.getElementById("change-shortcut-link");

const destDocs = document.getElementById("dest-docs");
const destLocal = document.getElementById("dest-local");
const destBoth = document.getElementById("dest-both");

const localSnippetsSection = document.getElementById("local-snippets-section");
const localSnippetsList = document.getElementById("local-snippets-list");
const exportSnippetsBtn = document.getElementById("export-snippets-btn");
const clearSnippetsBtn = document.getElementById("clear-snippets-btn");

// --- Initialize ---

document.addEventListener("DOMContentLoaded", init);

async function init() {
  // Check if we already have a token (non-interactive)
  chrome.identity.getAuthToken({ interactive: false }, async (token) => {
    if (token) {
      showConnectedState(token);
    } else {
      showSignedOutState();
    }
  });
}

// --- Auth: Sign In ---

authBtn.addEventListener("click", () => {
  authBtn.disabled = true;
  authBtn.textContent = "Signing in…";

  chrome.identity.getAuthToken({ interactive: true }, async (token) => {
    if (chrome.runtime.lastError || !token) {
      showMessage("error", chrome.runtime.lastError?.message || "Sign-in failed.");
      authBtn.disabled = false;
      authBtn.textContent = "Sign in with Google";
      return;
    }
    showConnectedState(token);
  });
});

// --- Auth: Sign Out ---

signoutBtn.addEventListener("click", () => {
  chrome.identity.getAuthToken({ interactive: false }, (token) => {
    if (token) {
      // Revoke the token
      chrome.identity.removeCachedAuthToken({ token }, () => {
        fetch(`https://accounts.google.com/o/oauth2/revoke?token=${token}`)
          .then(() => {
            showSignedOutState();
            showMessage("info", "Signed out successfully.");
          })
          .catch(() => {
            showSignedOutState();
          });
      });
    } else {
      showSignedOutState();
    }
  });
});

// --- Connect Existing Doc ---

saveDocBtn.addEventListener("click", async () => {
  const input = docInput.value.trim();
  if (!input) {
    showMessage("error", "Please enter a Google Doc URL or ID.");
    return;
  }

  const docId = extractDocId(input);
  if (!docId) {
    showMessage("error", "Invalid Google Doc URL or ID.");
    return;
  }

  saveDocBtn.disabled = true;
  saveDocBtn.textContent = "Connecting…";

  try {
    const token = await getToken();
    const info = await getDocInfo(token, docId);

    // Save to storage
    await saveTargetDoc(info.docId, info.title);
    updateDocInfoUI(info.title, info.docId);
    showMessage("success", `Connected to "${info.title}"`);
    docInput.value = "";
  } catch (error) {
    showMessage("error", `Could not connect: ${error.message}`);
  } finally {
    saveDocBtn.disabled = false;
    saveDocBtn.textContent = "Connect Doc";
  }
});

// --- Create New Doc ---

createDocBtn.addEventListener("click", async () => {
  const title = newDocTitle.value.trim() || "My Saved Snippets";

  createDocBtn.disabled = true;
  createDocBtn.textContent = "Creating…";

  try {
    const token = await getToken();
    const info = await createDoc(token, title);

    // Save to storage
    await saveTargetDoc(info.docId, info.title);
    updateDocInfoUI(info.title, info.docId);
    showMessage("success", `Created and connected "${info.title}"`);
    newDocTitle.value = "";
  } catch (error) {
    showMessage("error", `Could not create doc: ${error.message}`);
  } finally {
    createDocBtn.disabled = false;
    createDocBtn.textContent = "Create Doc";
  }
});

// --- UI State Management ---

async function showConnectedState(token) {
  authSection.classList.add("hidden");
  connectedSection.classList.remove("hidden");

  // Load saved doc info
  chrome.storage.sync.get(["targetDocId", "targetDocTitle"], (result) => {
    if (result.targetDocId) {
      updateDocInfoUI(result.targetDocTitle || "Untitled", result.targetDocId);
    }
  });

  // Load save history
  loadHistory();

  // Load toggle preferences (default: both enabled)
  chrome.storage.sync.get(["includeUrl", "includeTimestamp"], (result) => {
    toggleUrl.checked = result.includeUrl !== false;
    toggleTimestamp.checked = result.includeTimestamp !== false;
  });

  // Load destination preference (default: docs)
  chrome.storage.sync.get(["saveDestination"], (result) => {
    const dest = result.saveDestination || "docs";
    if (dest === "local") destLocal.checked = true;
    else if (dest === "both") destBoth.checked = true;
    else destDocs.checked = true;
    updateLocalSnippetsVisibility(dest);
  });

  // Load local snippets
  loadLocalSnippets();
}

function showSignedOutState() {
  authSection.classList.remove("hidden");
  connectedSection.classList.add("hidden");
  docInfo.classList.add("hidden");
  authStatus.textContent = "Not connected";
  authStatus.classList.remove("connected");
  authBtn.disabled = false;
  authBtn.textContent = "Sign in with Google";
}

function updateDocInfoUI(title, docId) {
  docInfo.classList.remove("hidden");
  docTitle.textContent = title;
  docLink.href = `https://docs.google.com/document/d/${docId}/edit`;
}

// --- Storage Helpers ---

function saveTargetDoc(docId, title) {
  return new Promise((resolve) => {
    chrome.storage.sync.set(
      { targetDocId: docId, targetDocTitle: title },
      resolve
    );
  });
}

// --- Token Helper ---

function getToken() {
  return new Promise((resolve, reject) => {
    chrome.identity.getAuthToken({ interactive: true }, (token) => {
      if (chrome.runtime.lastError || !token) {
        reject(new Error(chrome.runtime.lastError?.message || "Auth failed"));
      } else {
        resolve(token);
      }
    });
  });
}

// --- Message Display ---

function showMessage(type, text) {
  messageEl.textContent = text;
  messageEl.className = `message ${type}`;
  messageEl.classList.remove("hidden");

  // Auto-hide after 4 seconds
  setTimeout(() => {
    messageEl.classList.add("hidden");
  }, 4000);
}

// --- History ---

function loadHistory() {
  chrome.storage.local.get(["saveHistory"], (result) => {
    const history = result.saveHistory || [];
    renderHistory(history);
  });
}

function renderHistory(history) {
  if (history.length === 0) {
    historyList.innerHTML = '<p class="history-empty">No saved snippets yet.</p>';
    return;
  }

  historyList.innerHTML = history
    .map((entry) => {
      const time = formatTimeAgo(new Date(entry.timestamp));
      const hostname = getHostname(entry.url);
      return `
        <div class="history-item">
          <div class="history-item-text">${escapeHtml(entry.text)}</div>
          <div class="history-item-meta">
            <a class="history-item-url" href="${escapeHtml(entry.url)}" target="_blank" title="${escapeHtml(entry.url)}">${escapeHtml(hostname)}</a>
            <span class="history-item-time">${time}</span>
          </div>
        </div>
      `;
    })
    .join("");
}

clearHistoryBtn.addEventListener("click", () => {
  chrome.storage.local.set({ saveHistory: [] }, () => {
    renderHistory([]);
    showMessage("info", "History cleared.");
  });
});

// --- Preference Toggles ---

toggleUrl.addEventListener("change", () => {
  chrome.storage.sync.set({ includeUrl: toggleUrl.checked });
});

toggleTimestamp.addEventListener("change", () => {
  chrome.storage.sync.set({ includeTimestamp: toggleTimestamp.checked });
});

// --- Keyboard Shortcut ---

// Display the actual shortcut from Chrome's command registry
chrome.commands.getAll((commands) => {
  const saveCmd = commands.find((c) => c.name === "save-selection");
  if (saveCmd && saveCmd.shortcut) {
    shortcutKeys.textContent = saveCmd.shortcut;
  } else {
    shortcutKeys.textContent = "Not set";
  }
});

changeShortcutLink.addEventListener("click", (e) => {
  e.preventDefault();
  chrome.tabs.create({ url: "chrome://extensions/shortcuts" });
});

// --- Save Destination ---

function onDestinationChange() {
  const dest = document.querySelector('input[name="destination"]:checked').value;
  chrome.storage.sync.set({ saveDestination: dest });
  updateLocalSnippetsVisibility(dest);
}

function updateLocalSnippetsVisibility(dest) {
  if (dest === "local" || dest === "both") {
    localSnippetsSection.classList.remove("hidden");
  } else {
    localSnippetsSection.classList.add("hidden");
  }
}

destDocs.addEventListener("change", onDestinationChange);
destLocal.addEventListener("change", onDestinationChange);
destBoth.addEventListener("change", onDestinationChange);

// --- Local Snippets ---

function loadLocalSnippets() {
  chrome.storage.local.get(["localSnippets"], (result) => {
    renderLocalSnippets(result.localSnippets || []);
  });
}

function renderLocalSnippets(snippets) {
  if (snippets.length === 0) {
    localSnippetsList.innerHTML = '<p class="history-empty">No local snippets yet.</p>';
    return;
  }

  localSnippetsList.innerHTML = snippets
    .map((entry) => {
      const time = formatTimeAgo(new Date(entry.timestamp));
      const hostname = getHostname(entry.url);
      const preview = escapeHtml(
        entry.text.length > 100 ? entry.text.substring(0, 100) + "\u2026" : entry.text
      );
      return `
        <div class="history-item">
          <div class="history-item-text">${preview}</div>
          <div class="history-item-meta">
            <a class="history-item-url" href="${escapeHtml(entry.url)}" target="_blank" title="${escapeHtml(entry.url)}">${escapeHtml(hostname)}</a>
            <span class="history-item-time">${time}</span>
          </div>
        </div>
      `;
    })
    .join("");
}

clearSnippetsBtn.addEventListener("click", () => {
  chrome.storage.local.set({ localSnippets: [] }, () => {
    renderLocalSnippets([]);
    showMessage("info", "Local snippets cleared.");
  });
});

exportSnippetsBtn.addEventListener("click", () => {
  chrome.storage.local.get(["localSnippets"], (result) => {
    const snippets = result.localSnippets || [];
    if (snippets.length === 0) {
      showMessage("info", "No snippets to export.");
      return;
    }
    const blob = new Blob([JSON.stringify(snippets, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `snippets-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    showMessage("success", `Exported ${snippets.length} snippet(s).`);
  });
});

// --- Utility Helpers ---

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}

function getHostname(url) {
  try {
    return new URL(url).hostname;
  } catch {
    return url;
  }
}

function formatTimeAgo(date) {
  const now = new Date();
  const diff = Math.floor((now - date) / 1000);

  if (diff < 60) return "just now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  if (diff < 604800) return `${Math.floor(diff / 86400)}d ago`;
  return date.toLocaleDateString();
}
