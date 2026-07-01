"use client";

import { useT } from "@/i18n/locale-provider";
import { cn } from "@/lib/utils";
import type { MemoryCardItem } from "../game-types";

interface MemoryCardProps {
  item: MemoryCardItem;
  onClick: () => void;
  disabled: boolean;
  revealAll?: boolean;
}

export function MemoryCard({ item, onClick, disabled, revealAll }: MemoryCardProps) {
  const t = useT();
  const isFaceUp = item.isFlipped || item.isMatched || revealAll;

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled || item.isMatched}
      aria-label={isFaceUp ? item.card.term : t("games.memory.cardHidden")}
      className="group relative aspect-[3/4] w-full"
      style={{ perspective: "600px" }}
    >
      <div
        className={cn(
          "relative h-full w-full rounded-xl border-2 border-border bg-background-card shadow-sm transition-transform duration-300",
          isFaceUp && "[transform:rotateY(180deg)]",
        )}
        style={{ transformStyle: "preserve-3d" }}
      >
        {/* Back (hidden side) */}
        <div
          className="absolute inset-0 flex items-center justify-center rounded-xl bg-brand text-brand-foreground"
          style={{ backfaceVisibility: "hidden" }}
        >
          <span className="text-2xl font-black">?</span>
        </div>

        {/* Front (face-up side) */}
        <div
          className={cn(
            "absolute inset-0 flex flex-col items-center justify-center overflow-hidden rounded-xl bg-background-card p-2 text-center [transform:rotateY(180deg)]",
            item.isMatched && "opacity-60 ring-2 ring-emerald-500",
          )}
          style={{ backfaceVisibility: "hidden" }}
        >
          <span className="line-clamp-2 text-sm font-bold text-foreground">{item.card.term}</span>
          <span className="line-clamp-2 mt-1 text-xs text-foreground-secondary">{item.card.translation}</span>
        </div>
      </div>
    </button>
  );
}
