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

// --- Floating Save Button (two-button pill: Save | Edit) ---

let floatingBtn = null;
let editModal = null;

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

  // --- Edit button (right half) ---
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

  // Position above the cursor
  const btnWidth = 110;
  const btnHeight = 32;
  let posX = x - btnWidth / 2;
  let posY = y - btnHeight - 10;

  posX = Math.max(8, Math.min(posX, window.innerWidth - btnWidth - 8));
  posY = Math.max(8, posY);
  if (posY < 8) posY = y + 10;

  floatingBtn.style.left = `${posX}px`;
  floatingBtn.style.top = `${posY}px`;

  // Prevent propagation on both halves
  [saveBtn, editBtn].forEach((el) => {
    el.addEventListener("mousedown", (e) => e.stopPropagation());
    el.addEventListener("mouseup", (e) => e.stopPropagation());
  });

  // Save button click — instant save (same as before)
  saveBtn.addEventListener("click", (e) => {
    e.preventDefault();
    e.stopPropagation();
    saveBtn.style.backgroundColor = "#34A853";
    saveBtn.querySelector("span").textContent = "Saving…";

    chrome.runtime.sendMessage(
      { type: "SAVE_TEXT", text: selectedText, url: window.location.href },
      (response) => {
        if (response?.success) {
          saveBtn.querySelector("span").textContent = "Saved ✓";
          setTimeout(() => removeFloatingButton(), 800);
        } else {
          saveBtn.style.backgroundColor = "#EA4335";
          saveBtn.querySelector("span").textContent = "Failed";
          setTimeout(() => removeFloatingButton(), 1500);
        }
      }
    );
  });

  // Edit button click — open edit modal
  editBtn.addEventListener("click", (e) => {
    e.preventDefault();
    e.stopPropagation();
    removeFloatingButton();
    showEditModal(x, y, selectedText);
  });

  // Hover effects
  saveBtn.addEventListener("mouseenter", () => { saveBtn.style.backgroundColor = "#3367D6"; });
  saveBtn.addEventListener("mouseleave", () => { saveBtn.style.backgroundColor = "#4285F4"; });
  editBtn.addEventListener("mouseenter", () => { editBtn.style.backgroundColor = "#2a56c0"; });
  editBtn.addEventListener("mouseleave", () => { editBtn.style.backgroundColor = "#3367D6"; });

  floatingBtn.appendChild(saveBtn);
  floatingBtn.appendChild(editBtn);
  document.body.appendChild(floatingBtn);

  requestAnimationFrame(() => {
    floatingBtn.style.opacity = "1";
    floatingBtn.style.transform = "translateY(0)";
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

    modalSaveBtn.textContent = "Saving…";
    modalSaveBtn.style.opacity = "0.7";
    modalSaveBtn.disabled = true;

    chrome.runtime.sendMessage(
      { type: "SAVE_TEXT", text: editedText, url: window.location.href },
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
  textarea.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      removeEditModal();
    }
    if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
      e.preventDefault();
      modalSaveBtn.click();
    }
  });

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
  card.appendChild(textarea);
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
