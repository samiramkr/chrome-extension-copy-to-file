// =============================================================
// content.js — Content Script for "Save to Google Docs"
// =============================================================
// Responsibilities:
//   1. Listen for notifications from the background service worker
//   2. Display a toast notification overlay on the page
//   3. Show floating "Save" button near text selection
// =============================================================

// --- Message Listener ---

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.type === "SHOW_NOTIFICATION") {
    showToast(request.message);
  }
});

// --- Floating Save Button (three-button pill: Save | Edit | Translate) ---

let floatingBtn = null;
let editModal = null;

// --- Shared: Tag Input with Autocomplete ---

const FONT_SHARED = "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";

function createTagInput(parent) {
  const wrapper = document.createElement("div");
  Object.assign(wrapper.style, {
    position: "relative",
    marginTop: "12px",
    marginBottom: "4px",
  });

  const label = document.createElement("div");
  label.textContent = "🏷️ Tag:";
  Object.assign(label.style, {
    fontSize: "11px",
    fontWeight: "600",
    color: "#888",
    textTransform: "uppercase",
    letterSpacing: "0.5px",
    marginBottom: "4px",
  });

  const input = document.createElement("input");
  input.type = "text";
  input.placeholder = "e.g. research, vocab, recipe…";
  input.setAttribute("list", "gdocs-tag-suggestions");
  Object.assign(input.style, {
    width: "100%",
    padding: "7px 10px",
    fontSize: "13px",
    fontFamily: FONT_SHARED,
    border: "1px solid #ddd",
    borderRadius: "6px",
    outline: "none",
    boxSizing: "border-box",
    transition: "border-color 0.2s",
  });
  input.addEventListener("focus", () => {
    input.style.borderColor = "#4285F4";
    input.style.boxShadow = "0 0 0 2px rgba(66, 133, 244, 0.15)";
  });
  input.addEventListener("blur", () => {
    input.style.borderColor = "#ddd";
    input.style.boxShadow = "none";
  });

  // Datalist for autocomplete
  const datalist = document.createElement("datalist");
  datalist.id = "gdocs-tag-suggestions";

  // Load stored tags
  chrome.storage.sync.get(["usedTags"], (result) => {
    const tags = result.usedTags || [];
    tags.forEach((tag) => {
      const opt = document.createElement("option");
      opt.value = tag;
      datalist.appendChild(opt);
    });
  });

  wrapper.appendChild(label);
  wrapper.appendChild(input);
  wrapper.appendChild(datalist);
  parent.appendChild(wrapper);

  return input;
}

function saveUsedTag(tag) {
  if (!tag) return;
  chrome.storage.sync.get(["usedTags"], (result) => {
    let tags = result.usedTags || [];
    // Move to front if exists, otherwise prepend
    tags = tags.filter((t) => t.toLowerCase() !== tag.toLowerCase());
    tags.unshift(tag);
    if (tags.length > 20) tags.length = 20;
    chrome.storage.sync.set({ usedTags: tags });
  });
}

document.addEventListener("mouseup", (e) => {
  // Don't reposition if the edit modal is open
  if (editModal) return;

  // Small delay to let the selection finalize
  setTimeout(() => {
    const selectedText = window.getSelection().toString().trim();

    if (selectedText.length > 0) {
      showFloatingButton(e.clientX, e.clientY, selectedText);
    } else {
      removeFloatingButton();
    }
  }, 10);
});

// Hide button when clicking elsewhere (but not on the button or modal)
document.addEventListener("mousedown", (e) => {
  if (floatingBtn && !floatingBtn.contains(e.target)) {
    removeFloatingButton();
  }
  if (editModal && !editModal.contains(e.target)) {
    removeEditModal();
  }
});

// Hide button on scroll (but not modal)
document.addEventListener("scroll", () => {
  removeFloatingButton();
}, true);

function showFloatingButton(x, y, selectedText) {
  removeFloatingButton();

  floatingBtn = document.createElement("div");
  floatingBtn.id = "save-to-gdocs-float-btn";

  const FONT = "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";

  // Two-button pill container
  Object.assign(floatingBtn.style, {
    position: "fixed",
    zIndex: "2147483647",
    display: "flex",
    alignItems: "stretch",
    borderRadius: "20px",
    boxShadow: "0 2px 8px rgba(66, 133, 244, 0.4), 0 1px 3px rgba(0, 0, 0, 0.2)",
    overflow: "hidden",
    opacity: "0",
    transform: "translateY(4px)",
    transition: "opacity 0.15s ease, transform 0.15s ease",
    userSelect: "none",
  });

  // --- Save button (left half) ---
  const saveBtn = document.createElement("div");
  saveBtn.innerHTML = `
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="margin-right: 4px;">
      <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/>
      <polyline points="17 21 17 13 7 13 7 21"/>
      <polyline points="7 3 7 8 15 8"/>
    </svg>
    <span>Save</span>
  `;
  Object.assign(saveBtn.style, {
    display: "flex",
    alignItems: "center",
    padding: "6px 12px",
    backgroundColor: "#4285F4",
    color: "#fff",
    fontSize: "13px",
    fontFamily: FONT,
    fontWeight: "500",
    cursor: "pointer",
    whiteSpace: "nowrap",
    lineHeight: "1",
    transition: "background-color 0.15s",
  });

  // --- Edit button (middle) ---
  const editBtn = document.createElement("div");
  editBtn.innerHTML = `<span>✎</span>`;
  Object.assign(editBtn.style, {
    display: "flex",
    alignItems: "center",
    padding: "6px 10px",
    backgroundColor: "#3367D6",
    color: "#fff",
    fontSize: "14px",
    fontFamily: FONT,
    cursor: "pointer",
    whiteSpace: "nowrap",
    lineHeight: "1",
    borderLeft: "1px solid rgba(255,255,255,0.25)",
    transition: "background-color 0.15s",
  });

  // --- Translate button (right) ---
  const translateBtn = document.createElement("div");
  translateBtn.innerHTML = `<span>🌐</span>`;
  Object.assign(translateBtn.style, {
    display: "flex",
    alignItems: "center",
    padding: "6px 10px",
    backgroundColor: "#3367D6",
    color: "#fff",
    fontSize: "14px",
    fontFamily: FONT,
    cursor: "pointer",
    whiteSpace: "nowrap",
    lineHeight: "1",
    borderLeft: "1px solid rgba(255,255,255,0.25)",
    transition: "background-color 0.15s",
  });

  // Position above the cursor
  const btnWidth = 150;
  const btnHeight = 32;
  let posX = x - btnWidth / 2;
  let posY = y - btnHeight - 10;

  posX = Math.max(8, Math.min(posX, window.innerWidth - btnWidth - 8));
  posY = Math.max(8, posY);
  if (posY < 8) posY = y + 10;

  floatingBtn.style.left = `${posX}px`;
  floatingBtn.style.top = `${posY}px`;

  // Prevent propagation on all pill segments
  [saveBtn, editBtn, translateBtn].forEach((el) => {
    el.addEventListener("mousedown", (e) => e.stopPropagation());
    el.addEventListener("mouseup", (e) => e.stopPropagation());
  });

  // Save button click — check if tag prompt is enabled
  saveBtn.addEventListener("click", (e) => {
    e.preventDefault();
    e.stopPropagation();
    removeFloatingButton();

    chrome.storage.sync.get(["promptForTag"], (result) => {
      if (result.promptForTag !== false) {
        showTagPrompt(selectedText);
      } else {
        // Save directly without tag prompt
        showToast("Saving…");
        chrome.runtime.sendMessage(
          { type: "SAVE_TEXT", text: selectedText, url: window.location.href, tag: "" },
          (response) => {
            if (response?.success) {
              showToast("✅ Text saved to Google Docs!");
            } else {
              showToast("❌ Failed to save");
            }
          }
        );
      }
    });
  });

  // Edit button click — open edit modal
  editBtn.addEventListener("click", (e) => {
    e.preventDefault();
    e.stopPropagation();
    removeFloatingButton();
    showEditModal(x, y, selectedText);
  });

  // Translate button click — open translate modal
  translateBtn.addEventListener("click", (e) => {
    e.preventDefault();
    e.stopPropagation();
    removeFloatingButton();
    showTranslateModal(x, y, selectedText);
  });

  // Hover effects
  saveBtn.addEventListener("mouseenter", () => { saveBtn.style.backgroundColor = "#3367D6"; });
  saveBtn.addEventListener("mouseleave", () => { saveBtn.style.backgroundColor = "#4285F4"; });
  editBtn.addEventListener("mouseenter", () => { editBtn.style.backgroundColor = "#2a56c0"; });
  editBtn.addEventListener("mouseleave", () => { editBtn.style.backgroundColor = "#3367D6"; });
  translateBtn.addEventListener("mouseenter", () => { translateBtn.style.backgroundColor = "#2a56c0"; });
  translateBtn.addEventListener("mouseleave", () => { translateBtn.style.backgroundColor = "#3367D6"; });

  floatingBtn.appendChild(saveBtn);
  floatingBtn.appendChild(editBtn);
  floatingBtn.appendChild(translateBtn);
  document.body.appendChild(floatingBtn);

  requestAnimationFrame(() => {
    floatingBtn.style.opacity = "1";
    floatingBtn.style.transform = "translateY(0)";
  });
}

// --- Tag Prompt Mini-Modal ---

function showTagPrompt(selectedText) {
  removeEditModal();

  editModal = document.createElement("div");
  editModal.id = "save-to-gdocs-tag-prompt";

  Object.assign(editModal.style, {
    position: "fixed",
    top: "0",
    left: "0",
    width: "100vw",
    height: "100vh",
    zIndex: "2147483647",
    backgroundColor: "rgba(0, 0, 0, 0.3)",
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    opacity: "0",
    transition: "opacity 0.15s ease",
  });

  const card = document.createElement("div");
  Object.assign(card.style, {
    background: "#fff",
    borderRadius: "12px",
    boxShadow: "0 8px 32px rgba(0, 0, 0, 0.2)",
    padding: "16px",
    width: "320px",
    maxWidth: "90vw",
    display: "flex",
    flexDirection: "column",
    fontFamily: FONT_SHARED,
  });

  const title = document.createElement("div");
  title.textContent = "Add a tag";
  Object.assign(title.style, {
    fontSize: "14px",
    fontWeight: "600",
    color: "#1a1a1a",
    marginBottom: "4px",
  });

  const preview = document.createElement("div");
  preview.textContent = selectedText.length > 80 ? selectedText.substring(0, 80) + "…" : selectedText;
  Object.assign(preview.style, {
    fontSize: "12px",
    color: "#888",
    marginBottom: "8px",
    lineHeight: "1.4",
    fontStyle: "italic",
  });

  const tagInput = createTagInput(card);

  const btnRow = document.createElement("div");
  Object.assign(btnRow.style, {
    display: "flex",
    justifyContent: "flex-end",
    gap: "8px",
    marginTop: "12px",
  });

  const cancelBtn = document.createElement("button");
  cancelBtn.textContent = "Cancel";
  Object.assign(cancelBtn.style, {
    padding: "8px 16px",
    fontSize: "13px",
    fontWeight: "500",
    fontFamily: FONT_SHARED,
    border: "1px solid #ddd",
    borderRadius: "6px",
    background: "#fff",
    color: "#666",
    cursor: "pointer",
  });

  const saveNowBtn = document.createElement("button");
  saveNowBtn.textContent = "Save";
  Object.assign(saveNowBtn.style, {
    padding: "8px 20px",
    fontSize: "13px",
    fontWeight: "500",
    fontFamily: FONT_SHARED,
    border: "none",
    borderRadius: "6px",
    background: "#4285F4",
    color: "#fff",
    cursor: "pointer",
  });

  cancelBtn.addEventListener("click", () => removeEditModal());

  saveNowBtn.addEventListener("click", () => {
    const tag = tagInput.value.trim();
    if (tag) saveUsedTag(tag);

    saveNowBtn.textContent = "Saving…";
    saveNowBtn.disabled = true;
    saveNowBtn.style.opacity = "0.7";

    chrome.runtime.sendMessage(
      { type: "SAVE_TEXT", text: selectedText, url: window.location.href, tag },
      (response) => {
        if (response?.success) {
          saveNowBtn.textContent = "Saved ✓";
          saveNowBtn.style.backgroundColor = "#34A853";
          setTimeout(() => removeEditModal(), 600);
          showToast("✅ Text saved to Google Docs!");
        } else {
          saveNowBtn.textContent = "Failed";
          saveNowBtn.style.backgroundColor = "#EA4335";
          saveNowBtn.style.opacity = "1";
          saveNowBtn.disabled = false;
          setTimeout(() => {
            saveNowBtn.textContent = "Save";
            saveNowBtn.style.backgroundColor = "#4285F4";
          }, 1500);
        }
      }
    );
  });

  // Keyboard: Enter to save, Escape to cancel
  tagInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      saveNowBtn.click();
    }
    if (e.key === "Escape") {
      removeEditModal();
    }
  });

  editModal.addEventListener("mousedown", (e) => e.stopPropagation());
  editModal.addEventListener("mouseup", (e) => e.stopPropagation());
  editModal.addEventListener("click", (e) => {
    if (e.target === editModal) removeEditModal();
  });

  card.insertBefore(title, card.firstChild);
  card.insertBefore(preview, card.children[1]);
  btnRow.appendChild(cancelBtn);
  btnRow.appendChild(saveNowBtn);
  card.appendChild(btnRow);
  editModal.appendChild(card);
  document.body.appendChild(editModal);

  requestAnimationFrame(() => {
    editModal.style.opacity = "1";
    tagInput.focus();
  });
}

function removeFloatingButton() {
  if (floatingBtn) {
    floatingBtn.remove();
    floatingBtn = null;
  }
}

// --- Edit Modal ---

function showEditModal(x, y, selectedText) {
  removeEditModal();

  const FONT = "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";

  editModal = document.createElement("div");
  editModal.id = "save-to-gdocs-edit-modal";

  // Backdrop
  Object.assign(editModal.style, {
    position: "fixed",
    top: "0",
    left: "0",
    width: "100vw",
    height: "100vh",
    zIndex: "2147483647",
    backgroundColor: "rgba(0, 0, 0, 0.3)",
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    opacity: "0",
    transition: "opacity 0.15s ease",
  });

  // Modal card
  const card = document.createElement("div");
  Object.assign(card.style, {
    background: "#fff",
    borderRadius: "12px",
    boxShadow: "0 8px 32px rgba(0, 0, 0, 0.2)",
    padding: "16px",
    width: "380px",
    maxWidth: "90vw",
    maxHeight: "80vh",
    display: "flex",
    flexDirection: "column",
    fontFamily: FONT,
  });

  // Title
  const title = document.createElement("div");
  title.textContent = "Edit before saving";
  Object.assign(title.style, {
    fontSize: "14px",
    fontWeight: "600",
    color: "#1a1a1a",
    marginBottom: "12px",
  });

  // Textarea
  const textarea = document.createElement("textarea");
  textarea.value = selectedText;
  Object.assign(textarea.style, {
    width: "100%",
    minHeight: "120px",
    maxHeight: "50vh",
    padding: "10px 12px",
    fontSize: "13px",
    fontFamily: FONT,
    lineHeight: "1.5",
    color: "#333",
    border: "1px solid #ddd",
    borderRadius: "8px",
    outline: "none",
    resize: "vertical",
    boxSizing: "border-box",
    transition: "border-color 0.2s",
  });
  textarea.addEventListener("focus", () => {
    textarea.style.borderColor = "#4285F4";
    textarea.style.boxShadow = "0 0 0 2px rgba(66, 133, 244, 0.15)";
  });
  textarea.addEventListener("blur", () => {
    textarea.style.borderColor = "#ddd";
    textarea.style.boxShadow = "none";
  });

  // Tag input
  const editTagInput = createTagInput(card);

  // Button row
  const btnRow = document.createElement("div");
  Object.assign(btnRow.style, {
    display: "flex",
    justifyContent: "flex-end",
    gap: "8px",
    marginTop: "12px",
  });

  // Cancel button
  const cancelBtn = document.createElement("button");
  cancelBtn.textContent = "Cancel";
  Object.assign(cancelBtn.style, {
    padding: "8px 16px",
    fontSize: "13px",
    fontWeight: "500",
    fontFamily: FONT,
    border: "1px solid #ddd",
    borderRadius: "6px",
    background: "#fff",
    color: "#666",
    cursor: "pointer",
    transition: "background-color 0.15s",
  });
  cancelBtn.addEventListener("mouseenter", () => { cancelBtn.style.backgroundColor = "#f5f5f5"; });
  cancelBtn.addEventListener("mouseleave", () => { cancelBtn.style.backgroundColor = "#fff"; });

  // Save button
  const modalSaveBtn = document.createElement("button");
  modalSaveBtn.textContent = "Save";
  Object.assign(modalSaveBtn.style, {
    padding: "8px 20px",
    fontSize: "13px",
    fontWeight: "500",
    fontFamily: FONT,
    border: "none",
    borderRadius: "6px",
    background: "#4285F4",
    color: "#fff",
    cursor: "pointer",
    transition: "background-color 0.15s",
  });
  modalSaveBtn.addEventListener("mouseenter", () => { modalSaveBtn.style.backgroundColor = "#3367D6"; });
  modalSaveBtn.addEventListener("mouseleave", () => { modalSaveBtn.style.backgroundColor = "#4285F4"; });

  // Cancel action
  cancelBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    removeEditModal();
  });

  // Save action
  modalSaveBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    const editedText = textarea.value.trim();
    if (!editedText) {
      textarea.style.borderColor = "#EA4335";
      return;
    }

    const tag = editTagInput.value.trim();
    if (tag) saveUsedTag(tag);

    modalSaveBtn.textContent = "Saving…";
    modalSaveBtn.style.opacity = "0.7";
    modalSaveBtn.disabled = true;

    chrome.runtime.sendMessage(
      { type: "SAVE_TEXT", text: editedText, url: window.location.href, tag },
      (response) => {
        if (response?.success) {
          modalSaveBtn.textContent = "Saved ✓";
          modalSaveBtn.style.backgroundColor = "#34A853";
          setTimeout(() => removeEditModal(), 600);
          showToast("✅ Text saved to Google Docs!");
        } else {
          modalSaveBtn.textContent = "Failed";
          modalSaveBtn.style.backgroundColor = "#EA4335";
          modalSaveBtn.style.opacity = "1";
          modalSaveBtn.disabled = false;
          setTimeout(() => {
            modalSaveBtn.textContent = "Save";
            modalSaveBtn.style.backgroundColor = "#4285F4";
          }, 1500);
        }
      }
    );
  });

  // Keyboard: Escape to cancel, Ctrl/Cmd+Enter to save
  const onEditKeydown = (e) => {
    if (e.key === "Escape") {
      removeEditModal();
    }
    if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
      e.preventDefault();
      modalSaveBtn.click();
    }
  };
  textarea.addEventListener("keydown", onEditKeydown);
  editTagInput.addEventListener("keydown", onEditKeydown);

  // Prevent events from leaking to the page
  editModal.addEventListener("mousedown", (e) => e.stopPropagation());
  editModal.addEventListener("mouseup", (e) => e.stopPropagation());

  // Click backdrop to cancel
  editModal.addEventListener("click", (e) => {
    if (e.target === editModal) removeEditModal();
  });

  btnRow.appendChild(cancelBtn);
  btnRow.appendChild(modalSaveBtn);
  card.appendChild(title);
  card.appendChild(textarea);  // tag input already appended by createTagInput
  card.appendChild(btnRow);
  editModal.appendChild(card);
  document.body.appendChild(editModal);

  // Animate in and focus
  requestAnimationFrame(() => {
    editModal.style.opacity = "1";
    textarea.focus();
    // Place cursor at end
    textarea.setSelectionRange(textarea.value.length, textarea.value.length);
  });
}

function removeEditModal() {
  if (editModal) {
    editModal.remove();
    editModal = null;
  }
}

// --- Translation Modal ---

const LANGUAGES = [
  { code: "en", name: "English" },
  { code: "es", name: "Spanish" },
  { code: "fr", name: "French" },
  { code: "de", name: "German" },
  { code: "it", name: "Italian" },
  { code: "pt", name: "Portuguese" },
  { code: "ru", name: "Russian" },
  { code: "zh", name: "Chinese" },
  { code: "ja", name: "Japanese" },
  { code: "ko", name: "Korean" },
  { code: "ar", name: "Arabic" },
  { code: "hi", name: "Hindi" },
  { code: "tr", name: "Turkish" },
  { code: "nl", name: "Dutch" },
  { code: "fa", name: "Persian" },
  { code: "pl", name: "Polish" },
  { code: "sv", name: "Swedish" },
  { code: "vi", name: "Vietnamese" },
  { code: "th", name: "Thai" },
  { code: "uk", name: "Ukrainian" },
];

function showTranslateModal(x, y, selectedText) {
  removeEditModal();

  const FONT = "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";

  editModal = document.createElement("div");
  editModal.id = "save-to-gdocs-translate-modal";

  // Backdrop
  Object.assign(editModal.style, {
    position: "fixed",
    top: "0",
    left: "0",
    width: "100vw",
    height: "100vh",
    zIndex: "2147483647",
    backgroundColor: "rgba(0, 0, 0, 0.3)",
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    opacity: "0",
    transition: "opacity 0.15s ease",
  });

  // Modal card
  const card = document.createElement("div");
  Object.assign(card.style, {
    background: "#fff",
    borderRadius: "12px",
    boxShadow: "0 8px 32px rgba(0, 0, 0, 0.2)",
    padding: "16px",
    width: "420px",
    maxWidth: "90vw",
    maxHeight: "85vh",
    display: "flex",
    flexDirection: "column",
    fontFamily: FONT,
    overflow: "auto",
  });

  // Title
  const title = document.createElement("div");
  title.textContent = "Translate & Save";
  Object.assign(title.style, {
    fontSize: "14px",
    fontWeight: "600",
    color: "#1a1a1a",
    marginBottom: "12px",
  });

  // Language picker row
  const langRow = document.createElement("div");
  Object.assign(langRow.style, {
    display: "flex",
    alignItems: "center",
    gap: "8px",
    marginBottom: "12px",
  });

  const langLabel = document.createElement("span");
  langLabel.textContent = "Translate to:";
  Object.assign(langLabel.style, {
    fontSize: "13px",
    color: "#555",
    fontFamily: FONT,
    whiteSpace: "nowrap",
  });

  const langSelect = document.createElement("select");
  Object.assign(langSelect.style, {
    flex: "1",
    padding: "6px 10px",
    fontSize: "13px",
    fontFamily: FONT,
    border: "1px solid #ddd",
    borderRadius: "6px",
    outline: "none",
    cursor: "pointer",
  });

  LANGUAGES.forEach((lang) => {
    const opt = document.createElement("option");
    opt.value = lang.code;
    opt.textContent = lang.name;
    langSelect.appendChild(opt);
  });

  // Default to user's last choice or Spanish
  const lastLang = localStorage.getItem("gdocs-translate-lang") || "es";
  langSelect.value = lastLang;

  const translateNowBtn = document.createElement("button");
  translateNowBtn.textContent = "Translate";
  Object.assign(translateNowBtn.style, {
    padding: "6px 14px",
    fontSize: "13px",
    fontWeight: "500",
    fontFamily: FONT,
    border: "none",
    borderRadius: "6px",
    background: "#4285F4",
    color: "#fff",
    cursor: "pointer",
    transition: "background-color 0.15s",
    whiteSpace: "nowrap",
  });
  translateNowBtn.addEventListener("mouseenter", () => { translateNowBtn.style.backgroundColor = "#3367D6"; });
  translateNowBtn.addEventListener("mouseleave", () => { translateNowBtn.style.backgroundColor = "#4285F4"; });

  langRow.appendChild(langLabel);
  langRow.appendChild(langSelect);
  langRow.appendChild(translateNowBtn);

  // Original text (read-only)
  const origLabel = document.createElement("div");
  origLabel.textContent = "Original:";
  Object.assign(origLabel.style, {
    fontSize: "11px",
    fontWeight: "600",
    color: "#888",
    textTransform: "uppercase",
    letterSpacing: "0.5px",
    marginBottom: "4px",
  });

  const origBox = document.createElement("div");
  origBox.textContent = selectedText;
  Object.assign(origBox.style, {
    padding: "10px 12px",
    fontSize: "13px",
    fontFamily: FONT,
    lineHeight: "1.5",
    color: "#333",
    border: "1px solid #e0e0e0",
    borderRadius: "8px",
    background: "#f9f9f9",
    maxHeight: "120px",
    overflowY: "auto",
    marginBottom: "12px",
    whiteSpace: "pre-wrap",
    wordBreak: "break-word",
  });

  // Translation output
  const transLabel = document.createElement("div");
  transLabel.textContent = "Translation:";
  Object.assign(transLabel.style, {
    fontSize: "11px",
    fontWeight: "600",
    color: "#888",
    textTransform: "uppercase",
    letterSpacing: "0.5px",
    marginBottom: "4px",
  });

  const transBox = document.createElement("div");
  transBox.textContent = "Click \"Translate\" to see translation";
  Object.assign(transBox.style, {
    padding: "10px 12px",
    fontSize: "13px",
    fontFamily: FONT,
    lineHeight: "1.5",
    color: "#999",
    border: "1px solid #e0e0e0",
    borderRadius: "8px",
    background: "#fff",
    minHeight: "48px",
    maxHeight: "120px",
    overflowY: "auto",
    marginBottom: "12px",
    whiteSpace: "pre-wrap",
    wordBreak: "break-word",
    fontStyle: "italic",
  });

  let translatedText = "";
  let translatedLangName = "";

  // Translate action
  async function doTranslate() {
    const targetLang = langSelect.value;
    localStorage.setItem("gdocs-translate-lang", targetLang);
    translatedLangName = LANGUAGES.find((l) => l.code === targetLang)?.name || targetLang;

    translateNowBtn.textContent = "Translating…";
    translateNowBtn.disabled = true;
    translateNowBtn.style.opacity = "0.7";
    transBox.textContent = "Translating…";
    transBox.style.color = "#999";
    transBox.style.fontStyle = "italic";

    try {
      const result = await new Promise((resolve, reject) => {
        chrome.runtime.sendMessage(
          { type: "TRANSLATE_TEXT", text: selectedText, targetLang },
          (response) => {
            if (response?.success) resolve(response.translatedText);
            else reject(new Error(response?.error || "Translation failed"));
          }
        );
      });

      translatedText = result;
      transBox.textContent = result;
      transBox.style.color = "#333";
      transBox.style.fontStyle = "normal";
      modalSaveBtn.disabled = false;
      modalSaveBtn.style.opacity = "1";
    } catch (err) {
      transBox.textContent = `Error: ${err.message}`;
      transBox.style.color = "#EA4335";
      transBox.style.fontStyle = "normal";
    } finally {
      translateNowBtn.textContent = "Translate";
      translateNowBtn.disabled = false;
      translateNowBtn.style.opacity = "1";
    }
  }

  translateNowBtn.addEventListener("click", doTranslate);

  // Tag input
  const transTagInput = createTagInput(card);

  // Button row
  const btnRow = document.createElement("div");
  Object.assign(btnRow.style, {
    display: "flex",
    justifyContent: "flex-end",
    gap: "8px",
    marginTop: "4px",
  });

  // Cancel button
  const cancelBtn = document.createElement("button");
  cancelBtn.textContent = "Cancel";
  Object.assign(cancelBtn.style, {
    padding: "8px 16px",
    fontSize: "13px",
    fontWeight: "500",
    fontFamily: FONT,
    border: "1px solid #ddd",
    borderRadius: "6px",
    background: "#fff",
    color: "#666",
    cursor: "pointer",
    transition: "background-color 0.15s",
  });
  cancelBtn.addEventListener("mouseenter", () => { cancelBtn.style.backgroundColor = "#f5f5f5"; });
  cancelBtn.addEventListener("mouseleave", () => { cancelBtn.style.backgroundColor = "#fff"; });

  // Save button (disabled until translation is done)
  const modalSaveBtn = document.createElement("button");
  modalSaveBtn.textContent = "Save with Translation";
  modalSaveBtn.disabled = true;
  Object.assign(modalSaveBtn.style, {
    padding: "8px 20px",
    fontSize: "13px",
    fontWeight: "500",
    fontFamily: FONT,
    border: "none",
    borderRadius: "6px",
    background: "#4285F4",
    color: "#fff",
    cursor: "pointer",
    transition: "background-color 0.15s",
    opacity: "0.5",
  });
  modalSaveBtn.addEventListener("mouseenter", () => { if (!modalSaveBtn.disabled) modalSaveBtn.style.backgroundColor = "#3367D6"; });
  modalSaveBtn.addEventListener("mouseleave", () => { modalSaveBtn.style.backgroundColor = "#4285F4"; });

  // Cancel action
  cancelBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    removeEditModal();
  });

  // Save action — send both original and translated text
  modalSaveBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    if (!translatedText) return;

    const tag = transTagInput.value.trim();
    if (tag) saveUsedTag(tag);

    modalSaveBtn.textContent = "Saving…";
    modalSaveBtn.style.opacity = "0.7";
    modalSaveBtn.disabled = true;

    const combinedText = `${selectedText}\n\n🌐 ${translatedLangName} translation:\n${translatedText}`;

    chrome.runtime.sendMessage(
      { type: "SAVE_TEXT", text: combinedText, url: window.location.href, tag },
      (response) => {
        if (response?.success) {
          modalSaveBtn.textContent = "Saved ✓";
          modalSaveBtn.style.backgroundColor = "#34A853";
          setTimeout(() => removeEditModal(), 600);
          showToast("✅ Text + translation saved to Google Docs!");
        } else {
          modalSaveBtn.textContent = "Failed";
          modalSaveBtn.style.backgroundColor = "#EA4335";
          modalSaveBtn.style.opacity = "1";
          modalSaveBtn.disabled = false;
          setTimeout(() => {
            modalSaveBtn.textContent = "Save with Translation";
            modalSaveBtn.style.backgroundColor = "#4285F4";
          }, 1500);
        }
      }
    );
  });

  // Keyboard: Escape to cancel
  const onKeyDown = (e) => {
    if (e.key === "Escape") {
      removeEditModal();
      document.removeEventListener("keydown", onKeyDown);
    }
  };
  document.addEventListener("keydown", onKeyDown);

  // Prevent events from leaking
  editModal.addEventListener("mousedown", (e) => e.stopPropagation());
  editModal.addEventListener("mouseup", (e) => e.stopPropagation());

  // Click backdrop to cancel
  editModal.addEventListener("click", (e) => {
    if (e.target === editModal) removeEditModal();
  });

  btnRow.appendChild(cancelBtn);
  btnRow.appendChild(modalSaveBtn);

  card.appendChild(title);
  card.appendChild(langRow);
  card.appendChild(origLabel);
  card.appendChild(origBox);
  card.appendChild(transLabel);
  card.appendChild(transBox);  // tag input already appended by createTagInput
  card.appendChild(btnRow);
  editModal.appendChild(card);
  document.body.appendChild(editModal);

  // Animate in
  requestAnimationFrame(() => {
    editModal.style.opacity = "1";
  });
}

// --- Toast Notification ---

function showToast(message) {
  // Remove existing toast if any
  const existing = document.getElementById("save-to-gdocs-toast");
  if (existing) existing.remove();

  const toast = document.createElement("div");
  toast.id = "save-to-gdocs-toast";
  toast.textContent = message;

  Object.assign(toast.style, {
    position: "fixed",
    bottom: "24px",
    right: "24px",
    zIndex: "2147483647",
    padding: "12px 20px",
    backgroundColor: "#323232",
    color: "#fff",
    fontSize: "14px",
    fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
    borderRadius: "8px",
    boxShadow: "0 4px 12px rgba(0, 0, 0, 0.3)",
    opacity: "0",
    transition: "opacity 0.3s ease-in-out",
    maxWidth: "360px",
    lineHeight: "1.4",
    pointerEvents: "none",
  });

  document.body.appendChild(toast);

  // Fade in
  requestAnimationFrame(() => {
    toast.style.opacity = "1";
  });

  // Fade out and remove after 3 seconds
  setTimeout(() => {
    toast.style.opacity = "0";
    setTimeout(() => toast.remove(), 300);
  }, 3000);
}
