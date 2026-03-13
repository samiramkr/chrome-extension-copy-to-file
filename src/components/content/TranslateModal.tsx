import { useState } from "react";
import { TagInput } from "./TagInput";
import {
  sendSaveMessage,
  sendTranslateMessage,
  saveUsedTag,
} from "@/utils/content-helpers";
import { LANGUAGES } from "@/utils/constants";

interface TranslateModalProps {
  selectedText: string;
  onClose: () => void;
  onToast: (message: string) => void;
}

export function TranslateModal({
  selectedText,
  onClose,
  onToast,
}: TranslateModalProps) {
  const [targetLang, setTargetLang] = useState(
    () => localStorage.getItem("gdocs-translate-lang") || "es"
  );
  const [translatedText, setTranslatedText] = useState("");
  const [translatedLangName, setTranslatedLangName] = useState("");
  const [translating, setTranslating] = useState(false);
  const [translateError, setTranslateError] = useState("");
  const [tag, setTag] = useState("");
  const [saving, setSaving] = useState(false);

  const handleTranslate = async () => {
    localStorage.setItem("gdocs-translate-lang", targetLang);
    const langName =
      LANGUAGES.find((l) => l.code === targetLang)?.name || targetLang;
    setTranslatedLangName(langName);
    setTranslating(true);
    setTranslateError("");

    const resp = await sendTranslateMessage(selectedText, targetLang);
    setTranslating(false);

    if (resp?.success) {
      setTranslatedText(resp.translatedText);
    } else {
      setTranslateError("error" in resp ? resp.error : "Translation failed");
    }
  };

  const handleSave = async () => {
    if (!translatedText) return;
    if (tag.trim()) saveUsedTag(tag.trim());
    setSaving(true);

    const combinedText = `${selectedText}\n\n🌐 ${translatedLangName} translation:\n${translatedText}`;

    const resp = await sendSaveMessage(
      combinedText,
      window.location.href,
      tag.trim()
    );

    if (resp?.success) {
      onToast("✅ Text + translation saved to Google Docs!");
      setTimeout(onClose, 400);
    } else {
      setSaving(false);
      onToast("❌ Failed to save");
    }
  };

  return (
    <Backdrop onClose={onClose}>
      <div
        className="bg-white rounded-xl p-4 w-[420px] max-w-[90vw] max-h-[85vh] flex flex-col overflow-auto"
        style={{
          fontFamily:
            "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
          boxShadow: "0 8px 32px rgba(0, 0, 0, 0.2)",
        }}
      >
        <div className="text-sm font-semibold text-gray-900 mb-3">
          Translate & Save
        </div>

        {/* Language picker row */}
        <div className="flex items-center gap-2 mb-3">
          <span className="text-[13px] text-gray-500 whitespace-nowrap">
            Translate to:
          </span>
          <select
            value={targetLang}
            onChange={(e) => setTargetLang(e.target.value)}
            className="flex-1 py-1.5 px-2.5 text-[13px] border border-gray-300 rounded-md outline-none cursor-pointer"
          >
            {LANGUAGES.map((lang) => (
              <option key={lang.code} value={lang.code}>
                {lang.name}
              </option>
            ))}
          </select>
          <button
            onClick={handleTranslate}
            disabled={translating}
            className="py-1.5 px-3.5 text-[13px] font-medium border-none rounded-md bg-blue-500 text-white cursor-pointer hover:bg-blue-600 transition-colors disabled:opacity-70 whitespace-nowrap"
          >
            {translating ? "Translating…" : "Translate"}
          </button>
        </div>

        {/* Original text */}
        <div className="text-[11px] font-semibold text-gray-400 uppercase tracking-wide mb-1">
          Original:
        </div>
        <div className="py-2.5 px-3 text-[13px] leading-relaxed text-gray-800 border border-gray-200 rounded-lg bg-gray-50 max-h-[120px] overflow-y-auto mb-3 whitespace-pre-wrap break-words">
          {selectedText}
        </div>

        {/* Translation output */}
        <div className="text-[11px] font-semibold text-gray-400 uppercase tracking-wide mb-1">
          Translation:
        </div>
        <div
          className={`py-2.5 px-3 text-[13px] leading-relaxed border border-gray-200 rounded-lg min-h-[48px] max-h-[120px] overflow-y-auto mb-3 whitespace-pre-wrap break-words ${
            translatedText
              ? "text-gray-800 bg-white"
              : translateError
                ? "text-red-500 bg-white"
                : "text-gray-400 bg-white italic"
          }`}
        >
          {translatedText ||
            translateError ||
            'Click "Translate" to see translation'}
        </div>

        {/* Tag */}
        <TagInput value={tag} onChange={setTag} onEscape={onClose} />

        {/* Buttons */}
        <div className="flex justify-end gap-2 mt-1">
          <button
            onClick={onClose}
            className="py-2 px-4 text-[13px] font-medium border border-gray-300 rounded-md bg-white text-gray-500 cursor-pointer hover:bg-gray-50 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={!translatedText || saving}
            className="py-2 px-5 text-[13px] font-medium border-none rounded-md bg-blue-500 text-white cursor-pointer hover:bg-blue-600 transition-colors disabled:opacity-50"
          >
            {saving ? "Saving…" : "Save with Translation"}
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
      onKeyDown={(e) => {
        if (e.key === "Escape") onClose();
      }}
      className="fixed inset-0 z-[2147483647] bg-black/30 flex justify-center items-center animate-[fadeIn_0.15s_ease]"
    >
      {children}
    </div>
  );
}
