import { useEffect, useRef } from "react";
import {
  sendSaveMessage,
  getPromptForTag,
} from "@/utils/content-helpers";

interface FloatingPillProps {
  x: number;
  y: number;
  selectedText: string;
  onClose: () => void;
  onToast: (message: string) => void;
  onEdit: () => void;
  onTranslate: () => void;
  onShowTagPrompt: () => void;
}

export function FloatingPill({
  x,
  y,
  selectedText,
  onClose,
  onToast,
  onEdit,
  onTranslate,
  onShowTagPrompt,
}: FloatingPillProps) {
  const ref = useRef<HTMLDivElement>(null);

  // Position pill above cursor
  const btnWidth = 150;
  const btnHeight = 32;
  let posX = x - btnWidth / 2;
  let posY = y - btnHeight - 10;
  posX = Math.max(8, Math.min(posX, window.innerWidth - btnWidth - 8));
  posY = Math.max(8, posY);
  if (posY < 8) posY = y + 10;

  useEffect(() => {
    requestAnimationFrame(() => {
      if (ref.current) {
        ref.current.style.opacity = "1";
        ref.current.style.transform = "translateY(0)";
      }
    });
  }, []);

  const handleSave = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    const shouldPrompt = await getPromptForTag();
    if (shouldPrompt) {
      onShowTagPrompt();
    } else {
      onToast("Saving…");
      const resp = await sendSaveMessage(
        selectedText,
        window.location.href,
        ""
      );
      if (resp?.success) {
        onToast("✅ Text saved to Google Docs!");
        onClose();
      } else {
        onToast("❌ Failed to save");
      }
    }
  };

  const handleEdit = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    onEdit();
  };

  const handleTranslate = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    onTranslate();
  };

  return (
    <div
      ref={ref}
      onMouseDown={(e) => e.stopPropagation()}
      onMouseUp={(e) => e.stopPropagation()}
      style={{
        position: "fixed",
        left: `${posX}px`,
        top: `${posY}px`,
        zIndex: 2147483647,
        opacity: 0,
        transform: "translateY(4px)",
        transition: "opacity 0.15s ease, transform 0.15s ease",
        userSelect: "none",
      }}
      className="flex items-stretch rounded-[20px] overflow-hidden"
      role="toolbar"
    >
      {/* Save button */}
      <button
        onClick={handleSave}
        className="flex items-center gap-1 px-3 py-1.5 bg-blue-500 hover:bg-blue-600 text-white text-[13px] font-medium cursor-pointer border-none outline-none transition-colors whitespace-nowrap"
        style={{ fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" }}
      >
        <svg
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="shrink-0"
        >
          <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" />
          <polyline points="17 21 17 13 7 13 7 21" />
          <polyline points="7 3 7 8 15 8" />
        </svg>
        <span>Save</span>
      </button>

      {/* Edit button */}
      <button
        onClick={handleEdit}
        className="flex items-center px-2.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-sm cursor-pointer border-none outline-none border-l border-l-white/25 transition-colors"
        style={{ fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" }}
      >
        ✎
      </button>

      {/* Translate button */}
      <button
        onClick={handleTranslate}
        className="flex items-center px-2.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-sm cursor-pointer border-none outline-none border-l border-l-white/25 transition-colors"
        style={{ fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" }}
      >
        🌐
      </button>
    </div>
  );
}
