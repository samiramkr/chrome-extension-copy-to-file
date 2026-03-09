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
const docSelect = document.getElementById("doc-select");
const docLink = document.getElementById("doc-link");

const manualConnect = document.getElementById("manual-connect");
const docInput = document.getElementById("doc-input");
const saveDocBtn = document.getElementById("save-doc-btn");

const createDocSection = document.getElementById("create-doc-section");
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

    await saveTargetDoc(info.docId, info.title);
    await addToRecentDocs(info.docId, info.title);
    await loadRecentDocs();
    docSelect.value = info.docId;
    updateDocLink(info.docId);
    manualConnect.classList.add("hidden");
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

    await saveTargetDoc(info.docId, info.title);
    await addToRecentDocs(info.docId, info.title);
    await loadRecentDocs();
    docSelect.value = info.docId;
    updateDocLink(info.docId);
    createDocSection.classList.add("hidden");
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

  // Load recent docs into dropdown
  await loadRecentDocs();

  // Select the saved target doc
  chrome.storage.sync.get(["targetDocId"], (result) => {
    if (result.targetDocId) {
      docSelect.value = result.targetDocId;
      updateDocLink(result.targetDocId);
    }
  });

  // Load save history
  loadHistory();

  // Load toggle preferences (default: both enabled)
  chrome.storage.sync.get(["includeUrl", "includeTimestamp"], (result) => {
    toggleUrl.checked = result.includeUrl !== false;
    toggleTimestamp.checked = result.includeTimestamp !== false;
  });
}

function showSignedOutState() {
  authSection.classList.remove("hidden");
  connectedSection.classList.add("hidden");
  authStatus.textContent = "Not connected";
  authStatus.classList.remove("connected");
  authBtn.disabled = false;
  authBtn.textContent = "Sign in with Google";
}

function updateDocLink(docId) {
  if (docId && docId !== "__connect__" && docId !== "__create__") {
    docLink.href = `https://docs.google.com/document/d/${docId}/edit`;
    docLink.classList.remove("hidden");
  } else {
    docLink.classList.add("hidden");
  }
}

// --- Recent Docs Dropdown ---

async function loadRecentDocs() {
  try {
    const token = await getToken();

    // Fetch last 5 Google Docs from Drive API
    const response = await fetch(
      "https://www.googleapis.com/drive/v3/files?" +
        new URLSearchParams({
          q: "mimeType='application/vnd.google-apps.document' and trashed=false",
          orderBy: "modifiedByMeTime desc",
          pageSize: "5",
          fields: "files(id,name)",
        }),
      {
        headers: { Authorization: `Bearer ${token}` },
      }
    );

    if (!response.ok) throw new Error("Failed to fetch docs");

    const data = await response.json();
    const driveDocs = (data.files || []).map((f) => ({ docId: f.id, title: f.name }));

    // Also merge in any locally-stored recent docs (in case user connected one that isn't in top 5)
    const stored = await getRecentDocs();
    const merged = mergeDocs(driveDocs, stored);

    populateDropdown(merged);
  } catch (error) {
    console.warn("Could not load recent docs:", error);
    // Fall back to locally stored recent docs
    const stored = await getRecentDocs();
    if (stored.length > 0) {
      populateDropdown(stored);
    } else {
      docSelect.innerHTML = '<option value="" disabled selected>No docs found</option>';
      addDropdownActions();
    }
  }
}

function populateDropdown(docs) {
  docSelect.innerHTML = "";

  if (docs.length === 0) {
    const placeholder = document.createElement("option");
    placeholder.value = "";
    placeholder.disabled = true;
    placeholder.selected = true;
    placeholder.textContent = "No docs yet — create or connect one";
    docSelect.appendChild(placeholder);
  }

  docs.forEach((doc) => {
    const opt = document.createElement("option");
    opt.value = doc.docId;
    opt.textContent = doc.title;
    docSelect.appendChild(opt);
  });

  addDropdownActions();
}

function addDropdownActions() {
  // Separator
  const sep = document.createElement("option");
  sep.disabled = true;
  sep.textContent = "────────────";
  docSelect.appendChild(sep);

  // Connect by URL
  const connectOpt = document.createElement("option");
  connectOpt.value = "__connect__";
  connectOpt.textContent = "📎 Connect by URL…";
  connectOpt.className = "action-option";
  docSelect.appendChild(connectOpt);

  // Create new
  const createOpt = document.createElement("option");
  createOpt.value = "__create__";
  createOpt.textContent = "✚ Create new doc…";
  createOpt.className = "action-option";
  docSelect.appendChild(createOpt);
}

function mergeDocs(driveDocs, storedDocs) {
  const seen = new Set();
  const result = [];
  for (const doc of [...driveDocs, ...storedDocs]) {
    if (!seen.has(doc.docId)) {
      seen.add(doc.docId);
      result.push(doc);
    }
  }
  return result.slice(0, 7); // cap at 7 items
}

// --- Dropdown change handler ---

docSelect.addEventListener("change", async () => {
  const value = docSelect.value;

  if (value === "__connect__") {
    manualConnect.classList.remove("hidden");
    createDocSection.classList.add("hidden");
    docInput.focus();
    // Reset select to current target
    chrome.storage.sync.get(["targetDocId"], (r) => {
      if (r.targetDocId) docSelect.value = r.targetDocId;
    });
    return;
  }

  if (value === "__create__") {
    createDocSection.classList.remove("hidden");
    manualConnect.classList.add("hidden");
    newDocTitle.focus();
    // Reset select to current target
    chrome.storage.sync.get(["targetDocId"], (r) => {
      if (r.targetDocId) docSelect.value = r.targetDocId;
    });
    return;
  }

  // Regular doc selected
  manualConnect.classList.add("hidden");
  createDocSection.classList.add("hidden");

  const selectedOption = docSelect.options[docSelect.selectedIndex];
  const title = selectedOption.textContent;

  await saveTargetDoc(value, title);
  await addToRecentDocs(value, title);
  updateDocLink(value);
  showMessage("success", `Now saving to "${title}"`);
});

// --- Storage Helpers ---

function saveTargetDoc(docId, title) {
  return new Promise((resolve) => {
    chrome.storage.sync.set(
      { targetDocId: docId, targetDocTitle: title },
      resolve
    );
  });
}

function addToRecentDocs(docId, title) {
  return new Promise((resolve) => {
    chrome.storage.sync.get(["recentDocs"], (result) => {
      let docs = result.recentDocs || [];
      // Remove if already exists, then prepend
      docs = docs.filter((d) => d.docId !== docId);
      docs.unshift({ docId, title });
      if (docs.length > 5) docs.length = 5;
      chrome.storage.sync.set({ recentDocs: docs }, resolve);
    });
  });
}

function getRecentDocs() {
  return new Promise((resolve) => {
    chrome.storage.sync.get(["recentDocs"], (result) => {
      resolve(result.recentDocs || []);
    });
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
      const tagBadge = entry.tag
        ? `<span class="history-tag">${escapeHtml(entry.tag)}</span>`
        : "";
      return `
        <div class="history-item">
          <div class="history-item-text">${tagBadge}${escapeHtml(entry.text)}</div>
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
