"use client";

import { VocabularyCardView } from "@/features/cards/components/vocabulary-card-view";
import { cn } from "@/lib/utils";
import type { MemoryCardItem } from "../game-types";

interface MemoryCardProps {
  item: MemoryCardItem;
  isFlipped: boolean;
  onClick: () => void;
  disabled: boolean;
  revealAll?: boolean;
}

export function MemoryCard({ item, isFlipped, onClick, disabled, revealAll }: MemoryCardProps) {
  const face = item.isMatched || isFlipped || revealAll ? "front" : "back";

  return (
    <div
      className={cn(
        "relative aspect-[3/4] h-full w-full transition-opacity duration-200",
        item.isMatched && "opacity-60",
        disabled && !item.isMatched && "pointer-events-none",
      )}
    >
      <VocabularyCardView
        card={item.card}
        face={face}
        flippable={false}
        showActions={false}
        frontMinimal
        frontFit
        compact
        onClick={onClick}
        className="h-full w-full"
      />
    </div>
  );
}
