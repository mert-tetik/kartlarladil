"use client";

import { VOCABULARY_CARDS } from "@/data/cards";
import { VocabularyCardView } from "@/features/cards/components/vocabulary-card-view";
import type { InventoryCard } from "@/types/domain";

const PREVIEW_CARD =
  VOCABULARY_CARDS.find((card) => card.language === "en" && card.tier === "A1" && card.examples.length > 0) ??
  VOCABULARY_CARDS[0];

export default function LearnMobileQuizCardPreviewPage() {
  if (!PREVIEW_CARD) {
    return null;
  }

  const inventory: InventoryCard = {
    cardId: PREVIEW_CARD.id,
    status: "active",
    correctCount: 1,
    addedAt: "2026-07-05T00:00:00.000Z",
  };

  return (
    <section
      className="fixed inset-x-0 top-[calc(var(--app-header-height)+5rem)] bottom-[var(--mobile-nav-bar-height)] flex items-center justify-center bg-background"
      data-learn-mobile-quiz-card-preview
    >
      <div className="w-[min(285px,calc((100vw-3rem)/2))] max-w-full shrink-0" data-quiz-mobile-card>
        <VocabularyCardView
          card={PREVIEW_CARD}
          inventory={inventory}
          owned
          initialFace="front"
          face="front"
          flippable={false}
          footerMode="empty"
          className="h-auto w-full min-h-0 max-sm:aspect-[3/4] max-sm:min-h-0"
        />
      </div>
    </section>
  );
}
