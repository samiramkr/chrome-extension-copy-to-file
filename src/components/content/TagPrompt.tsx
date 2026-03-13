import { useState } from "react";
import { TagInput } from "./TagInput";
import { sendSaveMessage, saveUsedTag } from "@/utils/content-helpers";

interface TagPromptProps {
  selectedText: string;
  onClose: () => void;
  onToast: (message: string) => void;
}

export function TagPrompt({
  selectedText,
  onClose,
  onToast,
}: TagPromptProps) {
  const [tag, setTag] = useState("");
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (tag.trim()) saveUsedTag(tag.trim());
    setSaving(true);

    const resp = await sendSaveMessage(
      selectedText,
      window.location.href,
      tag.trim()
    );

    if (resp?.success) {
      onToast("✅ Text saved to Google Docs!");
      setTimeout(onClose, 400);
    } else {
      setSaving(false);
      onToast("❌ Failed to save");
    }
  };

  return (
    <Backdrop onClose={onClose}>
      <div
        className="bg-white rounded-xl p-4 w-80 max-w-[90vw] flex flex-col"
        style={{
          fontFamily:
            "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
          boxShadow: "0 8px 32px rgba(0, 0, 0, 0.2)",
        }}
      >
        <div className="text-sm font-semibold text-gray-900 mb-1">
          Add a tag
        </div>
        <div className="text-xs text-gray-400 mb-2 leading-relaxed italic">
          {selectedText.length > 80
            ? selectedText.substring(0, 80) + "…"
            : selectedText}
        </div>

        <TagInput
          value={tag}
          onChange={setTag}
          onEnter={handleSave}
          onEscape={onClose}
          autoFocus
        />

        <div className="flex justify-end gap-2 mt-3">
          <button
            onClick={onClose}
            className="py-2 px-4 text-[13px] font-medium border border-gray-300 rounded-md bg-white text-gray-500 cursor-pointer hover:bg-gray-50 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="py-2 px-5 text-[13px] font-medium border-none rounded-md bg-blue-500 text-white cursor-pointer hover:bg-blue-600 transition-colors disabled:opacity-70"
          >
            {saving ? "Saving…" : "Save"}
          </button>
        </div>
      </div>
    </Backdrop>
  );
}

function Backdrop({
  children,
  onClose,
}: {
  children: React.ReactNode;
  onClose: () => void;
}) {
  return (
    <div
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      onMouseDown={(e) => e.stopPropagation()}
      onMouseUp={(e) => e.stopPropagation()}
      className="fixed inset-0 z-[2147483647] bg-black/30 flex justify-center items-center animate-[fadeIn_0.15s_ease]"
    >
      {children}
    </div>
  );
}
