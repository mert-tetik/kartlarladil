"use client";

import { getPrimaryCardTranslation } from "@/features/cards/card-localization";
import { useLocale } from "@/i18n/locale-provider";
import { cn } from "@/lib/utils";
import type { MemoryCardItem } from "../game-types";

interface MemoryCardProps {
  item: MemoryCardItem;
  onClick: () => void;
  disabled: boolean;
  revealAll?: boolean;
}

const MEMORY_CARD_BACKGROUNDS = {
  A1: "/game-backgrounds/memory-cards/A1.png",
  A2: "/game-backgrounds/memory-cards/A2.png",
  B1: "/game-backgrounds/memory-cards/B1.png",
  B2: "/game-backgrounds/memory-cards/B2.png",
  C1: "/game-backgrounds/memory-cards/C1.png",
} as const;

export function MemoryCard({ item, onClick, disabled, revealAll }: MemoryCardProps) {
  const { locale } = useLocale();
  const isFaceUp = item.isMatched || item.isFlipped || revealAll;

  return (
    <button
      type="button"
      aria-label={isFaceUp ? item.card.term : "Reveal memory card"}
      aria-pressed={isFaceUp}
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "relative aspect-[3/4] h-full w-full overflow-hidden rounded-md p-0 text-left",
        "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white",
        item.isMatched && "animate-memory-card-match",
        disabled && "pointer-events-none",
      )}
      data-memory-card={item.id}
      data-card-face={isFaceUp ? "front" : "back"}
    >
      {isFaceUp ? (
        <span className="flex h-full w-full flex-col items-center justify-center gap-2 overflow-hidden bg-white px-2 py-3 text-center text-slate-950">
          <span className="max-w-full break-words font-display text-xl font-semibold leading-tight max-sm:text-lg">
            {item.card.term}
          </span>
          <span className="max-w-full break-words text-sm font-semibold leading-snug text-slate-700 max-sm:text-xs">
            {getPrimaryCardTranslation(item.card, locale)}
          </span>
        </span>
      ) : (
        <span
          aria-hidden="true"
          className="block h-full w-full bg-center bg-no-repeat"
          style={{
            backgroundImage: `url('${MEMORY_CARD_BACKGROUNDS[item.card.tier]}')`,
            backgroundSize: "cover",
          }}
        />
      )}
    </button>
  );
}
