"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Info, MessageCircleQuestion, X } from "lucide-react";
import { CardDetailsDialog } from "@/features/cards/components/card-details-dialog";
import { VocabularyCardView } from "@/features/cards/components/vocabulary-card-view";
import { useRequireAuthAction } from "@/features/auth/auth-client";
import { useInventoryStore } from "@/features/inventory/inventory-store";
import { useT } from "@/i18n/locale-provider";
import { cn } from "@/lib/utils";
import type { VocabularyCard } from "@/types/domain";

interface MobileCardDisplaySheetProps {
  card: VocabularyCard | null;
  isOpen: boolean;
  onClose: () => void;
}

export function MobileCardDisplaySheet({ card, isOpen, onClose }: MobileCardDisplaySheetProps) {
  const t = useT();
  const router = useRouter();
  const requireAuth = useRequireAuthAction();
  const [face, setFace] = useState<"front" | "back">("back");
  const [detailsOpen, setDetailsOpen] = useState(false);
  const inventory = useInventoryStore((state) =>
    card ? state.cards.find((item) => item.cardId === card.id) : undefined,
  );

  if (!card) return null;

  const currentCard = card;

  function handleBackdropClick() {
    onClose();
  }

  function handleCardAreaClick(event: React.MouseEvent<HTMLDivElement>) {
    if ((event.target as HTMLElement).closest("button")) return;
    setFace((current) => (current === "front" ? "back" : "front"));
  }

  function handleAskClick() {
    const askPath = `/ask/${currentCard.language}?term=${encodeURIComponent(currentCard.term)}`;
    requireAuth(() => router.push(askPath), { nextPath: askPath });
  }

  const actionButtonClass =
    "inline-flex size-10 items-center justify-center rounded-full bg-black/40 text-white transition-colors hover:bg-black/60";

  return (
    <div
      key={`${card.id}-${isOpen ? "open" : "closed"}`}
      className={cn(
        "fixed inset-0 z-[60] flex items-center justify-center bg-black/60 p-4 transition-opacity duration-300 max-lg:flex lg:hidden",
        isOpen ? "opacity-100" : "pointer-events-none opacity-0",
      )}
      aria-hidden={!isOpen}
      inert={!isOpen}
      onClick={handleBackdropClick}
      data-mobile-card-display-sheet
    >
      <div
        className="relative w-full max-w-[260px]"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="absolute -top-12 right-0 flex items-center gap-2">
          <button
            type="button"
            onClick={() => setDetailsOpen(true)}
            aria-label={`${card.term} ${t("cards.details")}`}
            title={t("cards.details")}
            className={actionButtonClass}
          >
            <Info className="size-5" aria-hidden="true" />
          </button>
          <button
            type="button"
            onClick={handleAskClick}
            aria-label={`${card.term} ${t("cards.ask")}`}
            title={t("cards.ask")}
            className={actionButtonClass}
          >
            <MessageCircleQuestion className="size-5" aria-hidden="true" />
          </button>
          <button
            type="button"
            onClick={onClose}
            aria-label={t("common.close")}
            title={t("common.close")}
            className={actionButtonClass}
          >
            <X className="size-5" aria-hidden="true" />
          </button>
        </div>

        <div onClick={handleCardAreaClick}>
          <VocabularyCardView
            card={card}
            inventory={inventory}
            owned
            face={face}
            initialFace="back"
            flippable={false}
            showActions={false}
            frontFit
            className="h-auto w-full max-w-[260px]"
          />
        </div>
      </div>

      <CardDetailsDialog card={card} open={detailsOpen} onOpenChange={setDetailsOpen} />
    </div>
  );
}
