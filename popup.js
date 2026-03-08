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
