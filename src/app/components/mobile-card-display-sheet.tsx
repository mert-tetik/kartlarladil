"use client";

import { useEffect, useState } from "react";
import { Info, MessageCircle, X } from "lucide-react";
import { VocabularyCardView } from "@/features/cards/components/vocabulary-card-view";
import { useT } from "@/i18n/locale-provider";
import { cn } from "@/lib/utils";
import type { VocabularyCard } from "@/types/domain";

interface MobileCardDisplaySheetProps {
  card: VocabularyCard | null;
  isOpen: boolean;
  onClose: () => void;
}

export function MobileCardDisplaySheet({
  card,
  isOpen,
  onClose,
}: MobileCardDisplaySheetProps) {
  const t = useT();
  const [face, setFace] = useState<"front" | "back">("back");

  if (!card) return null;

  useEffect(() => {
    if (isOpen && card) {
      setFace("back");
    }
  }, [isOpen, card?.id]);

  function handleBackdropClick() {
    onClose();
  }

  function handleCardAreaClick(event: React.MouseEvent<HTMLDivElement>) {
    if ((event.target as HTMLElement).closest("button")) return;
    setFace((current) => (current === "front" ? "back" : "front"));
  }

  return (
    <div
      className={cn(
        "fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4 transition-opacity duration-300 max-lg:flex lg:hidden",
        isOpen ? "opacity-100" : "pointer-events-none opacity-0",
      )}
      aria-hidden={!isOpen}
      inert={!isOpen}
      onClick={handleBackdropClick}
      data-mobile-card-display-sheet
    >
      <div
        className="relative w-full max-w-[320px]"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="absolute -top-12 right-0 flex items-center gap-2">
          <span className="inline-flex size-10 items-center justify-center rounded-full bg-black/40 text-white">
            <Info className="size-5" aria-hidden="true" />
          </span>
          <span className="inline-flex size-10 items-center justify-center rounded-full bg-black/40 text-white">
            <MessageCircle className="size-5" aria-hidden="true" />
          </span>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex size-10 items-center justify-center rounded-full bg-black/40 text-white transition-colors hover:bg-black/60"
            aria-label={t("common.close")}
          >
            <X className="size-5" aria-hidden="true" />
          </button>
        </div>

        <div onClick={handleCardAreaClick}>
          <VocabularyCardView
            card={card}
            owned
            face={face}
            initialFace="back"
            flippable={false}
            showActions={false}
            className="w-full"
          />
        </div>
      </div>
    </div>
  );
}
