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

// --- Floating Save Button ---

let floatingBtn = null;

document.addEventListener("mouseup", (e) => {
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

// Hide button when clicking elsewhere (but not on the button itself)
document.addEventListener("mousedown", (e) => {
  if (floatingBtn && !floatingBtn.contains(e.target)) {
    removeFloatingButton();
  }
});

// Hide button on scroll
document.addEventListener("scroll", () => {
  removeFloatingButton();
}, true);

function showFloatingButton(x, y, selectedText) {
  removeFloatingButton();

  floatingBtn = document.createElement("div");
  floatingBtn.id = "save-to-gdocs-float-btn";

  // Button content: icon + text
  floatingBtn.innerHTML = `
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="vertical-align: middle; margin-right: 4px;">
      <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/>
      <polyline points="17 21 17 13 7 13 7 21"/>
      <polyline points="7 3 7 8 15 8"/>
    </svg>
    <span style="vertical-align: middle;">Save</span>
  `;

  // Position above the cursor
  const btnWidth = 80;
  const btnHeight = 32;
  let posX = x - btnWidth / 2;
  let posY = y - btnHeight - 10;

  // Keep within viewport
  posX = Math.max(8, Math.min(posX, window.innerWidth - btnWidth - 8));
  posY = Math.max(8, posY);

  // If would be above viewport, show below cursor instead
  if (posY < 8) {
    posY = y + 10;
  }

  Object.assign(floatingBtn.style, {
    position: "fixed",
    left: `${posX}px`,
    top: `${posY}px`,
    zIndex: "2147483647",
    padding: "6px 12px",
    backgroundColor: "#4285F4",
    color: "#fff",
    fontSize: "13px",
    fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
    fontWeight: "500",
    borderRadius: "20px",
    boxShadow: "0 2px 8px rgba(66, 133, 244, 0.4), 0 1px 3px rgba(0, 0, 0, 0.2)",
    cursor: "pointer",
    userSelect: "none",
    whiteSpace: "nowrap",
    opacity: "0",
    transform: "translateY(4px)",
    transition: "opacity 0.15s ease, transform 0.15s ease",
    lineHeight: "1",
    display: "flex",
    alignItems: "center",
  });

  floatingBtn.addEventListener("click", (e) => {
    e.preventDefault();
    e.stopPropagation();

    // Visual feedback
    floatingBtn.style.backgroundColor = "#34A853";
    floatingBtn.querySelector("span").textContent = "Saving…";

    // Send to background for saving
    chrome.runtime.sendMessage(
      {
        type: "SAVE_TEXT",
        text: selectedText,
        url: window.location.href,
      },
      (response) => {
        if (response?.success) {
          floatingBtn.querySelector("span").textContent = "Saved ✓";
          setTimeout(() => removeFloatingButton(), 800);
        } else {
          floatingBtn.style.backgroundColor = "#EA4335";
          floatingBtn.querySelector("span").textContent = "Failed";
          setTimeout(() => removeFloatingButton(), 1500);
        }
      }
    );
  });

  // Hover effect
  floatingBtn.addEventListener("mouseenter", () => {
    floatingBtn.style.backgroundColor = "#3367D6";
    floatingBtn.style.boxShadow = "0 3px 12px rgba(66, 133, 244, 0.5), 0 2px 4px rgba(0, 0, 0, 0.2)";
  });
  floatingBtn.addEventListener("mouseleave", () => {
    floatingBtn.style.backgroundColor = "#4285F4";
    floatingBtn.style.boxShadow = "0 2px 8px rgba(66, 133, 244, 0.4), 0 1px 3px rgba(0, 0, 0, 0.2)";
  });

  document.body.appendChild(floatingBtn);

  // Animate in
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
