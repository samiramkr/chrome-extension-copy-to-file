import { useState, useEffect } from "react";

interface Prefs {
  includeUrl: boolean;
  includeTimestamp: boolean;
  promptForTag: boolean;
  showDiffColors: boolean;
}

export function Preferences() {
  const [prefs, setPrefs] = useState<Prefs>({
    includeUrl: true,
    includeTimestamp: true,
    promptForTag: true,
    showDiffColors: true,
  });

  useEffect(() => {
    chrome.storage.sync.get(
      ["includeUrl", "includeTimestamp", "promptForTag", "showDiffColors"],
      (result) => {
        setPrefs({
          includeUrl: result.includeUrl !== false,
          includeTimestamp: result.includeTimestamp !== false,
          promptForTag: result.promptForTag !== false,
          showDiffColors: result.showDiffColors !== false,
        });
      }
    );
  }, []);

  const toggle = (key: keyof Prefs) => {
    const newValue = !prefs[key];
    setPrefs((prev) => ({ ...prev, [key]: newValue }));
    chrome.storage.sync.set({ [key]: newValue });
  };

  const options: { key: keyof Prefs; label: string }[] = [
    { key: "includeUrl", label: "Include source URL" },
    { key: "includeTimestamp", label: "Include timestamp" },
    { key: "promptForTag", label: "Prompt for tag when saving" },
    { key: "showDiffColors", label: "Show edit diff colors" },
  ];

  return (
    <div className="mb-1">
      <label className="block text-[11px] uppercase tracking-wide text-gray-400 font-medium mb-2">
        Save Options
      </label>
      {options.map(({ key, label }) => (
        <label
          key={key}
          className="flex items-center gap-2 py-1.5 cursor-pointer text-sm text-gray-600"
        >
          <input
            type="checkbox"
            checked={prefs[key]}
            onChange={() => toggle(key)}
            className="w-4 h-4 accent-blue-500 cursor-pointer shrink-0"
          />
          <span className="select-none">{label}</span>
        </label>
      ))}
    </div>
  );
}
