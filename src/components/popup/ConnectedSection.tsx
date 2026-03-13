import { useState, useEffect, useCallback } from "react";
import { DocSelector } from "./DocSelector";
import { Preferences } from "./Preferences";
import { History } from "./History";
import type { HistoryEntry } from "@/types";

interface ConnectedSectionProps {
  token: string;
  onSignOut: () => void;
  showMessage: (type: "success" | "error" | "info", text: string) => void;
}

export function ConnectedSection({
  token,
  onSignOut,
  showMessage,
}: ConnectedSectionProps) {
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [shortcut, setShortcut] = useState("⌘+Shift+S");

  const loadHistory = useCallback(() => {
    chrome.storage.local.get(["saveHistory"], (result) => {
      setHistory(result.saveHistory || []);
    });
  }, []);

  useEffect(() => {
    loadHistory();

    // Load keyboard shortcut
    chrome.commands.getAll((commands) => {
      const saveCmd = commands.find((c) => c.name === "save-selection");
      if (saveCmd?.shortcut) {
        setShortcut(saveCmd.shortcut);
      } else {
        setShortcut("Not set");
      }
    });
  }, [loadHistory]);

  const clearHistory = () => {
    chrome.storage.local.set({ saveHistory: [] }, () => {
      setHistory([]);
      showMessage("info", "History cleared.");
    });
  };

  return (
    <div>
      <DocSelector token={token} showMessage={showMessage} />

      <div className="h-px bg-gray-200 my-3.5" />

      <Preferences />

      <div className="h-px bg-gray-200 my-3.5" />

      {/* Keyboard Shortcut */}
      <div className="flex justify-between items-center">
        <div className="flex flex-col gap-1">
          <label className="text-[11px] uppercase tracking-wide text-gray-400 font-medium">
            Keyboard Shortcut
          </label>
          <kbd className="inline-block px-2 py-0.5 font-mono text-xs text-gray-500 bg-gray-100 border border-gray-300 rounded shadow-[0_1px_0_#ccc]">
            {shortcut}
          </kbd>
        </div>
        <a
          href="#"
          onClick={(e) => {
            e.preventDefault();
            chrome.tabs.create({ url: "chrome://extensions/shortcuts" });
          }}
          className="text-xs text-blue-500 hover:underline self-end"
        >
          Change
        </a>
      </div>

      <div className="h-px bg-gray-200 my-3.5" />

      {/* Sign Out */}
      <button
        onClick={onSignOut}
        className="w-full py-2 px-3 text-xs text-gray-400 bg-transparent border border-gray-300 rounded-lg hover:bg-gray-50 hover:text-gray-500 transition-colors cursor-pointer"
      >
        Sign Out
      </button>

      <div className="h-px bg-gray-200 my-3.5" />

      {/* History */}
      <History
        entries={history}
        onClear={clearHistory}
      />
    </div>
  );
}
