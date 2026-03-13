import { computeWordDiff } from "@/utils/diff";
import { translateText } from "@/utils/translate";
import type {
  ExtensionMessage,
  Preferences,
  DiffSegment,
  HistoryEntry,
} from "@/types";

export default defineBackground(() => {
  // ─── Context Menu Setup ───

  chrome.runtime.onInstalled.addListener(() => {
    chrome.contextMenus.create({
      id: "save-to-google-docs",
      title: "Save to Google Docs",
      contexts: ["selection"],
    });
  });

  // ─── Context Menu Click Handler ───

  chrome.contextMenus.onClicked.addListener(async (info, tab) => {
    if (info.menuItemId !== "save-to-google-docs") return;
    const selectedText = info.selectionText;
    if (!selectedText) {
      notify("No text selected.");
      return;
    }
    await saveText(selectedText, tab?.url ?? "", "");
  });

  // ─── Keyboard Shortcut Handler ───

  chrome.commands.onCommand.addListener(async (command) => {
    if (command !== "save-selection") return;

    const [tab] = await chrome.tabs.query({
      active: true,
      currentWindow: true,
    });
    if (!tab?.id) return;

    const [result] = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: () => window.getSelection()?.toString() ?? "",
    });

    const selectedText = result?.result as string;
    if (!selectedText) {
      notify("No text selected.");
      return;
    }

    await saveText(selectedText, tab.url ?? "", "");
  });

  // ─── Authentication ───

  function getAuthToken(): Promise<string> {
    return new Promise((resolve, reject) => {
      chrome.identity.getAuthToken({ interactive: true }, (token) => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
        } else {
          resolve(token!);
        }
      });
    });
  }

  // ─── Google Docs API: Append Text ───

  async function appendToDoc(
    token: string,
    docId: string,
    text: string,
    sourceUrl: string,
    tag: string,
    originalText?: string
  ): Promise<void> {
    const prefs = await getPreferences();

    const separator = "\n———————————————————————————\n";
    const headerParts: string[] = [];

    if (tag) {
      headerParts.push(`🏷️ ${tag}`);
    }
    if (prefs.includeTimestamp) {
      const now = new Date();
      const time =
        now.toLocaleDateString("en-US", {
          month: "short",
          day: "numeric",
          year: "numeric",
        }) +
        " · " +
        now.toLocaleTimeString("en-US", {
          hour: "numeric",
          minute: "2-digit",
        });
      headerParts.push(`📌 ${time}`);
    }
    if (prefs.includeUrl) {
      headerParts.push(`🔗 link`);
    }

    const header =
      headerParts.length > 0 ? headerParts.join(" - ") + "\n\n" : "";
    const prefix = `${separator}${header}`;

    // Check if this is an edited save with diff colors enabled
    const hasEdits =
      prefs.showDiffColors &&
      originalText &&
      originalText.trim() !== text.trim();

    let bodyText: string;
    let diffSegments: DiffSegment[] | null = null;

    if (hasEdits) {
      diffSegments = computeWordDiff(originalText!, text);
      bodyText = diffSegments.map((s) => s.text).join("");
    } else {
      bodyText = text;
    }

    const content = `${prefix}${bodyText}\n`;

    const requests: Record<string, unknown>[] = [
      {
        insertText: {
          location: { index: 1 },
          text: content,
        },
      },
    ];

    // Apply hyperlink to "link" word
    if (prefs.includeUrl && sourceUrl) {
      const linkWordIndex =
        content.indexOf("🔗 link") + "🔗 ".length + 1;
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
                  color: {
                    rgbColor: { red: 0.133, green: 0.545, blue: 0.133 },
                  },
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
                  color: {
                    rgbColor: { red: 0.82, green: 0.1, blue: 0.1 },
                  },
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
  }

  // ─── Central Save Logic ───

  async function saveText(
    text: string,
    sourceUrl: string,
    tag: string,
    originalText?: string
  ): Promise<void> {
    try {
      const token = await getAuthToken();
      const docId = await getTargetDocId();
      if (!docId) {
        notify(
          "No Google Doc configured. Click the extension icon to set one up."
        );
        throw new Error("No Google Doc configured.");
      }
      await appendToDoc(token, docId, text, sourceUrl, tag, originalText);
      saveToHistory(text, sourceUrl, tag);
      notify("✅ Text saved to Google Docs!");
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Unknown error";
      console.error("Save to Google Docs failed:", error);
      notify(`❌ Failed to save: ${message}`);
      throw error;
    }
  }

  // ─── Storage Helpers ───

  function getPreferences(): Promise<Preferences> {
    return new Promise((resolve) => {
      chrome.storage.sync.get(
        ["includeUrl", "includeTimestamp", "showDiffColors"],
        (result) => {
          resolve({
            includeUrl: result.includeUrl !== false,
            includeTimestamp: result.includeTimestamp !== false,
            showDiffColors: result.showDiffColors !== false,
          });
        }
      );
    });
  }

  function getTargetDocId(): Promise<string | null> {
    return new Promise((resolve) => {
      chrome.storage.sync.get(["targetDocId"], (result) => {
        resolve(result.targetDocId || null);
      });
    });
  }

  function saveToHistory(text: string, url: string, tag: string): void {
    const entry: HistoryEntry = {
      text: text.length > 100 ? text.substring(0, 100) + "…" : text,
      url,
      tag: tag || "",
      timestamp: new Date().toISOString(),
    };

    chrome.storage.local.get(["saveHistory"], (result) => {
      const history: HistoryEntry[] = result.saveHistory || [];
      history.unshift(entry);
      if (history.length > 20) history.length = 20;
      chrome.storage.local.set({ saveHistory: history });
    });
  }

  // ─── Notifications ───

  function notify(message: string): void {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0]?.id) {
        chrome.tabs.sendMessage(tabs[0].id, {
          type: "SHOW_NOTIFICATION",
          message,
        });
      }
    });
  }

  // ─── Message Listener ───

  chrome.runtime.onMessage.addListener(
    (request: ExtensionMessage, _sender, sendResponse) => {
      if (request.type === "GET_AUTH_TOKEN") {
        getAuthToken()
          .then((token) => sendResponse({ success: true, token }))
          .catch((error: Error) =>
            sendResponse({ success: false, error: error.message })
          );
        return true;
      }

      if (request.type === "SAVE_TEXT") {
        (async () => {
          try {
            await saveText(
              request.text,
              request.url,
              request.tag,
              request.originalText
            );
            sendResponse({ success: true });
          } catch (error) {
            const message =
              error instanceof Error ? error.message : "Unknown error";
            sendResponse({ success: false, error: message });
          }
        })();
        return true;
      }

      if (request.type === "TRANSLATE_TEXT") {
        (async () => {
          try {
            const translatedText = await translateText(
              request.text,
              request.targetLang
            );
            sendResponse({ success: true, translatedText });
          } catch (error) {
            const message =
              error instanceof Error ? error.message : "Unknown error";
            sendResponse({ success: false, error: message });
          }
        })();
        return true;
      }
    }
  );
});
