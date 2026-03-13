import { useState, useEffect, useRef } from "react";
import { getUsedTags } from "@/utils/content-helpers";

interface TagInputProps {
  value: string;
  onChange: (value: string) => void;
  onEnter?: () => void;
  onEscape?: () => void;
  autoFocus?: boolean;
}

export function TagInput({
  value,
  onChange,
  onEnter,
  onEscape,
  autoFocus,
}: TagInputProps) {
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    getUsedTags().then(setSuggestions);
  }, []);

  useEffect(() => {
    if (autoFocus) inputRef.current?.focus();
  }, [autoFocus]);

  return (
    <div className="relative mt-3 mb-1">
      <div className="text-[11px] font-semibold text-gray-400 uppercase tracking-wide mb-1">
        🏷️ Tag:
      </div>
      <input
        ref={inputRef}
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            onEnter?.();
          }
          if (e.key === "Escape") {
            onEscape?.();
          }
        }}
        placeholder="e.g. research, vocab, recipe…"
        list="gdocs-tag-suggestions"
        className="w-full py-[7px] px-2.5 text-[13px] border border-gray-300 rounded-md outline-none transition-all focus:border-blue-500 focus:ring-2 focus:ring-blue-500/15"
        style={{
          fontFamily:
            "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
          boxSizing: "border-box",
        }}
      />
      <datalist id="gdocs-tag-suggestions">
        {suggestions.map((tag) => (
          <option key={tag} value={tag} />
        ))}
      </datalist>
    </div>
  );
}
