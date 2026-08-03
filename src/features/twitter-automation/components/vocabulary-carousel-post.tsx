import { VocabularyCardView } from "@/features/cards/components/vocabulary-card-view";
import { canUseSuperWater, formatSuperWaterText } from "@/lib/super-water";
import { cn } from "@/lib/utils";
import type { LanguageCode, VocabularyCard } from "@/types/domain";

type VocabularyCarouselPostProps = {
  card: VocabularyCard;
  index: number;
  nativeLanguage: LanguageCode;
  presentation?: "meaning" | "tier";
  slideCount?: number;
  onSlideRef?: (element: HTMLDivElement | null) => void;
};

const TIER_SURFACES = {
  A1: "#174c3f",
  A2: "#173d59",
  B1: "#392969",
  B2: "#633d12",
  C1: "#651c35",
} as const;

const TIER_ACCENTS = {
  A1: "#5eead4",
  A2: "#7dd3fc",
  B1: "#c4b5fd",
  B2: "#fcd34d",
  C1: "#fda4af",
} as const;

export function VocabularyCarouselPost({ card, index, nativeLanguage, presentation = "meaning", slideCount = 6, onSlideRef }: VocabularyCarouselPostProps) {
  const meaning = card.translations[nativeLanguage] || card.translation;
  const usesSuperWater = canUseSuperWater(nativeLanguage);
  const headline = presentation === "tier" ? card.tier : usesSuperWater ? formatSuperWaterText(nativeLanguage, meaning) : meaning;

  return (
    <article
      className="relative aspect-[3/4] w-[360px] shrink-0 overflow-hidden rounded-lg border border-white/15 bg-[#16120f] p-5 text-[#fffaf4] sm:w-[440px] sm:p-6"
      data-social-vocabulary-carousel-slide
      ref={onSlideRef}
      style={{ background: `linear-gradient(155deg, ${TIER_SURFACES[card.tier]} 0%, #16120f 48%, #16120f 100%)` }}
    >
      {presentation === "tier" ? <div className="flex items-center justify-between text-xs font-semibold text-white/70">
        <span>FoxiesDeck</span>
        <span>{index + 1}/{slideCount}</span>
      </div> : null}
      <h2 className={cn(presentation === "meaning" ? "mt-5" : "mt-8", "break-words text-center font-display text-4xl font-semibold leading-[0.92] sm:text-5xl", presentation === "meaning" && usesSuperWater && "font-super-water")} style={presentation === "tier" ? { color: TIER_ACCENTS[card.tier] } : undefined}>
        {headline}
      </h2>
      {presentation === "tier" ? <p className="mt-3 text-center text-xs leading-5 text-white/65">{card.language.toUpperCase()} · {card.tier} vocabulary</p> : null}
      <div className="absolute inset-x-0 bottom-0 flex justify-center px-8 pb-9 sm:px-10 sm:pb-11">
        <div className={cn("w-full", presentation === "meaning" ? "max-w-[172px] sm:max-w-[192px]" : "max-w-[224px] sm:max-w-[252px]")}>
          <VocabularyCardView card={card} face="front" flippable={false} frontFit showActions={false} translationLocale={nativeLanguage} />
        </div>
      </div>
    </article>
  );
}
