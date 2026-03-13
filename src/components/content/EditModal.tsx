import { useState, useRef, useEffect } from "react";
import { TagInput } from "./TagInput";
import { sendSaveMessage, saveUsedTag } from "@/utils/content-helpers";

interface EditModalProps {
  selectedText: string;
  onClose: () => void;
  onToast: (message: string) => void;
}

export function EditModal({
  selectedText,
  onClose,
  onToast,
}: EditModalProps) {
  const [editedText, setEditedText] = useState(selectedText);
  const [tag, setTag] = useState("");
  const [saving, setSaving] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.focus();
      textareaRef.current.setSelectionRange(
        textareaRef.current.value.length,
        textareaRef.current.value.length
      );
    }
  }, []);

  const handleSave = async () => {
    const text = editedText.trim();
    if (!text) return;

    if (tag.trim()) saveUsedTag(tag.trim());
    setSaving(true);

    const resp = await sendSaveMessage(
      text,
      window.location.href,
      tag.trim(),
      selectedText // originalText for diff
    );

    if (resp?.success) {
      onToast("✅ Text saved to Google Docs!");
      setTimeout(onClose, 400);
    } else {
      setSaving(false);
      onToast("❌ Failed to save");
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") onClose();
    if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
      e.preventDefault();
      handleSave();
    }
  };

  return (
    <Backdrop onClose={onClose}>
      <div
        className="bg-white rounded-xl p-4 w-[380px] max-w-[90vw] max-h-[80vh] flex flex-col"
        style={{
          fontFamily:
            "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
          boxShadow: "0 8px 32px rgba(0, 0, 0, 0.2)",
        }}
      >
        <div className="text-sm font-semibold text-gray-900 mb-3">
          Edit before saving
        </div>

        <textarea
          ref={textareaRef}
          value={editedText}
          onChange={(e) => setEditedText(e.target.value)}
          onKeyDown={handleKeyDown}
          className="w-full min-h-[120px] max-h-[50vh] py-2.5 px-3 text-[13px] leading-relaxed text-gray-800 border border-gray-300 rounded-lg outline-none resize-y transition-all focus:border-blue-500 focus:ring-2 focus:ring-blue-500/15"
          style={{
            fontFamily:
              "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
            boxSizing: "border-box",
          }}
        />

        <TagInput
          value={tag}
          onChange={setTag}
          onEnter={handleSave}
          onEscape={onClose}
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
