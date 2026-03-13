import ReactDOM from "react-dom/client";
import { ContentApp } from "@/components/content/ContentApp";
import cssText from "@/assets/styles.css?inline";

export default defineContentScript({
  matches: ["<all_urls>"],
  cssInjectionMode: "ui",

  async main(ctx) {
    // Listen for notifications from background
    chrome.runtime.onMessage.addListener((request) => {
      if (request.type === "SHOW_NOTIFICATION") {
        showToastDirectly(request.message);
      }
    });

    // Track selection and show floating pill
    let currentUi: Awaited<ReturnType<typeof createShadowRootUi>> | null = null;

    document.addEventListener("mouseup", (e) => {
      setTimeout(async () => {
        const selectedText = window.getSelection()?.toString().trim() || "";
        if (selectedText.length > 0) {
          await showUI(ctx, e.clientX, e.clientY, selectedText);
        } else {
          removeUI();
        }
      }, 10);
    });

    document.addEventListener("mousedown", (e) => {
      if (currentUi?.shadowHost && !e.composedPath().includes(currentUi.shadowHost)) {
        removeUI();
      }
    });

    document.addEventListener("scroll", () => removeUI(), true);

    async function showUI(
      ctx: Parameters<typeof createShadowRootUi>[0],
      x: number,
      y: number,
      selectedText: string
    ) {
      removeUI();

      currentUi = await createShadowRootUi(ctx, {
        name: "save-to-gdocs",
        position: "overlay",
        anchor: "body",
        onMount(container) {
          // Inject Tailwind styles into shadow DOM
          const style = document.createElement("style");
          style.textContent = cssText;
          container.host.shadowRoot?.prepend(style);

          container.style.position = "fixed";
          container.style.zIndex = "2147483647";
          container.style.pointerEvents = "auto";

          const root = ReactDOM.createRoot(container);
          root.render(
            <ContentApp
              x={x}
              y={y}
              selectedText={selectedText}
              onClose={removeUI}
              onToast={showToastDirectly}
            />
          );
          return root;
        },
        onRemove(root) {
          root?.unmount();
        },
      });

      currentUi.mount();
    }

    function removeUI() {
      if (currentUi) {
        currentUi.remove();
        currentUi = null;
      }
    }

    // Direct DOM toast (not React, since it needs to work without the UI mounted)
    function showToastDirectly(message: string) {
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
        fontFamily:
          "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
        borderRadius: "8px",
        boxShadow: "0 4px 12px rgba(0, 0, 0, 0.3)",
        opacity: "0",
        transition: "opacity 0.3s ease-in-out",
        maxWidth: "360px",
        lineHeight: "1.4",
        pointerEvents: "none",
      });

      document.body.appendChild(toast);
      requestAnimationFrame(() => {
        toast.style.opacity = "1";
      });
      setTimeout(() => {
        toast.style.opacity = "0";
        setTimeout(() => toast.remove(), 300);
      }, 3000);
    }
  },
});
