import type { SaveResponse, TranslateResponse } from "@/types";

// ─── Shared helpers for content script ───

export function sendSaveMessage(
  text: string,
  url: string,
  tag: string,
  originalText?: string
): Promise<SaveResponse> {
  return new Promise((resolve) => {
    chrome.runtime.sendMessage(
      { type: "SAVE_TEXT", text, url, tag, originalText },
      (response: SaveResponse) => resolve(response)
    );
  });
}

export function sendTranslateMessage(
  text: string,
  targetLang: string
): Promise<TranslateResponse> {
  return new Promise((resolve) => {
    chrome.runtime.sendMessage(
      { type: "TRANSLATE_TEXT", text, targetLang },
      (response: TranslateResponse) => resolve(response)
    );
  });
}

export function saveUsedTag(tag: string): void {
  if (!tag) return;
  chrome.storage.sync.get(["usedTags"], (result) => {
    let tags: string[] = result.usedTags || [];
    tags = tags.filter((t) => t.toLowerCase() !== tag.toLowerCase());
    tags.unshift(tag);
    if (tags.length > 20) tags.length = 20;
    chrome.storage.sync.set({ usedTags: tags });
  });
}

export function getUsedTags(): Promise<string[]> {
  return new Promise((resolve) => {
    chrome.storage.sync.get(["usedTags"], (result) => {
      resolve(result.usedTags || []);
    });
  });
}

export function getPromptForTag(): Promise<boolean> {
  return new Promise((resolve) => {
    chrome.storage.sync.get(["promptForTag"], (result) => {
      resolve(result.promptForTag !== false);
    });
  });
}
