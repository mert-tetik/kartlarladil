"use client";

import { getCardTranslationMeanings } from "@/features/cards/card-localization";
import { VocabularyCardDesign } from "@/features/cards/components/card-design-reference-preview";
import type { CardDesignTestSample } from "@/features/cards/card-design-test-sample";
import { cn } from "@/lib/utils";
import type { LanguageCode, Tier, VocabularyCard } from "@/types/domain";

type AutomationCardFace = "front" | "back";
type AutomationCardLayout = "standard" | "daily-challenge";

type AutomationVocabularyCardProps = {
  card: VocabularyCard;
  face: AutomationCardFace;
  nativeLanguage: LanguageCode;
  layout?: AutomationCardLayout;
  contentScale?: number;
  className?: string;
};

export function AutomationVocabularyCard({
  card,
  face,
  nativeLanguage,
  layout = "standard",
  contentScale = 1,
  className,
}: AutomationVocabularyCardProps) {
  const sample: CardDesignTestSample = {
    cardId: card.id,
    learningLanguage: card.language,
    nativeLanguage,
    tier: card.tier as Tier,
    term: card.term,
    translation: getCardTranslationMeanings(card, nativeLanguage).slice(0, 3).join(", "),
    partOfSpeech: card.partOfSpeech,
    pronunciation: card.pronunciation,
    example: card.examples[0]?.sentence ?? card.example,
  };

  return (
    <div
      aria-label={`${card.term}, ${card.tier}`}
      className={cn("relative aspect-[3/4] min-w-0", className)}
      data-automation-card-face={face}
      data-automation-card-layout={face === "front" ? layout : undefined}
      data-card-face={face}
      data-theme="default"
      role="group"
    >
      <VocabularyCardDesign
        className="h-full w-full"
        contentScale={contentScale}
        sample={sample}
        showBack={face === "back"}
      />
    </div>
  );
}
