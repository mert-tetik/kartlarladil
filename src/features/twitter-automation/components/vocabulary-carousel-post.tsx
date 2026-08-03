import { VocabularyCardView } from "@/features/cards/components/vocabulary-card-view";
import { canUseSuperWater, formatSuperWaterText } from "@/lib/super-water";
import { cn } from "@/lib/utils";
import type { LanguageCode, VocabularyCard } from "@/types/domain";

type VocabularyCarouselPostProps = {
  card: VocabularyCard;
  nativeLanguage: LanguageCode;
  presentation?: "meaning" | "tier";
  onSlideRef?: (element: HTMLDivElement | null) => void;
};

const TIER_BACKGROUND_IMAGES = {
  A1: "/colored-backgrounds/green.png",
  A2: "/colored-backgrounds/blue.png",
  B1: "/colored-backgrounds/purple.png",
  B2: "/colored-backgrounds/yellow.png",
  C1: "/colored-backgrounds/red.png",
} as const;

const TIER_ACCENTS = {
  A1: "#5eead4",
  A2: "#7dd3fc",
  B1: "#c4b5fd",
  B2: "#fcd34d",
  C1: "#fda4af",
} as const;

function StaticCarouselCardFace({ card, nativeLanguage }: Pick<VocabularyCarouselPostProps, "card" | "nativeLanguage">) {
  const translation = card.translations[nativeLanguage] || card.translation;
  const example = card.examples[0]?.sentence ?? card.example;

  return (
    <div className="aspect-[3/4] w-full rounded-lg border-[3px] border-white/85 bg-[#fffaf4] p-2.5 text-white">
      <div className="flex h-full flex-col rounded-md border-2 border-[#df8700] bg-gradient-to-b from-[#ffb600] to-[#d46e00] p-4 text-center sm:p-5">
        <div className="flex items-center justify-between text-[10px] font-semibold text-white/85 sm:text-xs">
          <span>{card.language.toUpperCase()}</span>
          <span>{card.tier}</span>
        </div>
        <div className="flex flex-1 flex-col items-center justify-center">
          <p className="text-xs font-medium text-white/80 sm:text-sm">{card.pronunciation}</p>
          <h3 className="mt-3 break-words font-display text-3xl font-semibold leading-none sm:text-4xl">{card.term}</h3>
          <p className="mt-4 text-base font-semibold leading-5 sm:text-lg">{translation}</p>
        </div>
        <p className="line-clamp-2 min-h-10 text-xs font-medium leading-4 text-white/90 sm:text-sm sm:leading-5">{example}</p>
      </div>
    </div>
  );
}

export function VocabularyCarouselPost({ card, nativeLanguage, presentation = "meaning", onSlideRef }: VocabularyCarouselPostProps) {
  const meaning = card.translations[nativeLanguage] || card.translation;
  const usesSuperWater = canUseSuperWater(nativeLanguage);
  const headline = presentation === "tier" ? card.tier : usesSuperWater ? formatSuperWaterText(nativeLanguage, meaning) : meaning;
  const displayHeadline = headline.toLocaleUpperCase(nativeLanguage);

  return (
    <article
      className="relative aspect-[3/4] w-[360px] shrink-0 overflow-hidden rounded-lg border border-white/15 bg-[#16120f] p-5 text-[#fffaf4] sm:w-[440px] sm:p-6"
      data-social-vocabulary-carousel-slide
      ref={onSlideRef}
      style={{ backgroundImage: `url(${TIER_BACKGROUND_IMAGES[card.tier]})`, backgroundPosition: "center", backgroundSize: "cover" }}
    >
      <h2 className={cn(presentation === "meaning" ? "mt-5" : "mt-8", "break-words text-center font-display text-4xl font-semibold leading-[0.92] sm:text-5xl", presentation === "meaning" && usesSuperWater && "font-super-water")} style={{ color: presentation === "tier" ? TIER_ACCENTS[card.tier] : "#17120e" }}>
        {displayHeadline}
      </h2>
      <div className="absolute inset-x-0 bottom-0 grid place-items-center px-8 pb-9 sm:px-10 sm:pb-11">
        <div className={cn("w-full", presentation === "meaning" ? "max-w-[224px] sm:max-w-[252px]" : "max-w-[260px] sm:max-w-[296px]")} data-carousel-card-face="front">
          {presentation === "meaning" ? <StaticCarouselCardFace card={card} nativeLanguage={nativeLanguage} /> : <VocabularyCardView card={card} className="mx-auto" face="front" flippable={false} frontFit showActions={false} translationLocale={nativeLanguage} />}
        </div>
      </div>
    </article>
  );
}
