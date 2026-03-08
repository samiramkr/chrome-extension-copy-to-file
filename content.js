// =============================================================
// content.js — Content Script for "Save to Google Docs"
// =============================================================
// Responsibilities:
//   1. Listen for notifications from the background service worker
//   2. Display a toast notification overlay on the page
// =============================================================

// --- Message Listener ---

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.type === "SHOW_NOTIFICATION") {
    showToast(request.message);
  }
});

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
