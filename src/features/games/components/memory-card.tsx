"use client";

import { VocabularyCardView } from "@/features/cards/components/vocabulary-card-view";
import { cn } from "@/lib/utils";
import type { MemoryCardItem } from "../game-types";

interface MemoryCardProps {
  item: MemoryCardItem;
  onClick: () => void;
  disabled: boolean;
  revealAll?: boolean;
}

export function MemoryCard({ item, onClick, disabled, revealAll }: MemoryCardProps) {
  const face = item.isMatched || item.isFlipped || revealAll ? "front" : "back";

  return (
    <div
      className={cn(
        "relative aspect-[3/4] h-full w-full",
        item.isMatched && "animate-memory-card-match",
        disabled && "pointer-events-none",
      )}
      data-memory-card={item.id}
    >
      <VocabularyCardView
        card={item.card}
        face={face}
        flippable={false}
        showActions={false}
        frontMinimal
        frontFit
        compact
        primaryTranslationOnly
        memoryGame
        onClick={onClick}
        className="h-full w-full"
      />
    </div>
  );
}
