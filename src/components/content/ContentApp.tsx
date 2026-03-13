import { useState } from "react";
import { FloatingPill } from "@/components/content/FloatingPill";
import { TagPrompt } from "@/components/content/TagPrompt";
import { EditModal } from "@/components/content/EditModal";
import { TranslateModal } from "@/components/content/TranslateModal";

type ModalType = "none" | "tagPrompt" | "edit" | "translate";

interface ContentAppProps {
  x: number;
  y: number;
  selectedText: string;
  onClose: () => void;
  onToast: (message: string) => void;
}

export function ContentApp({
  x,
  y,
  selectedText,
  onClose,
  onToast,
}: ContentAppProps) {
  const [modal, setModal] = useState<ModalType>("none");

  if (modal === "tagPrompt") {
    return (
      <TagPrompt
        selectedText={selectedText}
        onClose={onClose}
        onToast={onToast}
      />
    );
  }

  if (modal === "edit") {
    return (
      <EditModal
        selectedText={selectedText}
        onClose={onClose}
        onToast={onToast}
      />
    );
  }

  if (modal === "translate") {
    return (
      <TranslateModal
        selectedText={selectedText}
        onClose={onClose}
        onToast={onToast}
      />
    );
  }

  return (
    <FloatingPill
      x={x}
      y={y}
      selectedText={selectedText}
      onClose={onClose}
      onToast={onToast}
      onEdit={() => setModal("edit")}
      onTranslate={() => setModal("translate")}
      onShowTagPrompt={() => setModal("tagPrompt")}
    />
  );
}
