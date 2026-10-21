"use client";

import { Volume2 } from "lucide-react";
import { getCardTranslationMeanings } from "@/features/cards/card-localization";
import { getLanguageDisplayName } from "@/i18n/labels";
import { canUseSuperWater, formatSuperWaterText } from "@/lib/super-water";
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

const CARD_SKINS: Record<Tier, {
  accent: string;
  border: string;
}> = {
  A1: {
    accent: "#10b981",
    border: "rgba(16, 185, 129, 0.7)",
  },
  A2: {
    accent: "#0ea5e9",
    border: "rgba(14, 165, 233, 0.7)",
  },
  B1: {
    accent: "#8b5cf6",
    border: "rgba(139, 92, 246, 0.7)",
  },
  B2: {
    accent: "#f59e0b",
    border: "rgba(245, 158, 11, 0.7)",
  },
  C1: {
    accent: "#f43f5e",
    border: "rgba(244, 63, 94, 0.7)",
  },
};

export function AutomationVocabularyCard({
  card,
  face,
  nativeLanguage,
  layout = "standard",
  contentScale = 1,
  className,
}: AutomationVocabularyCardProps) {
  const skin = CARD_SKINS[card.tier];

  return (
    <article
      aria-label={`${card.term}, ${card.tier}`}
      className={cn("relative aspect-[3/4] min-w-0 overflow-hidden rounded-lg", className)}
      data-automation-card-face={face}
      data-automation-card-layout={face === "front" ? layout : undefined}
      data-card-face={face}
      data-theme="default"
    >
      {face === "front" ? (
        <CardFront
          card={card}
          layout={layout}
          nativeLanguage={nativeLanguage}
          skin={skin}
          contentScale={contentScale}
        />
      ) : (
        <CardBack card={card} skin={skin} />
      )}
    </article>
  );
}

function CardFront({
  card,
  layout,
  nativeLanguage,
  skin,
  contentScale,
}: {
  card: VocabularyCard;
  layout: AutomationCardLayout;
  nativeLanguage: LanguageCode;
  skin: (typeof CARD_SKINS)[Tier];
  contentScale: number;
}) {
  const translations = getCardTranslationMeanings(card, nativeLanguage).slice(0, 3).join(", ");
  const example = card.examples[0]?.sentence ?? card.example;
  const isDailyChallenge = layout === "daily-challenge";
  const headerText = `${getLanguageDisplayName(card.language, nativeLanguage)} ${card.tier}`;
  const headerDisplay = canUseSuperWater(nativeLanguage)
    ? formatSuperWaterText(nativeLanguage, headerText)
    : headerText;

  return (
    <div
      className="absolute inset-0 flex min-h-0 flex-col overflow-hidden rounded-lg border bg-white p-2.5 text-slate-950 sm:p-4"
      data-card-front
      style={{ borderColor: skin.border }}
    >
      <header
        className={cn(
          "-mx-2.5 -mt-2.5 flex items-center justify-center px-3 py-2 text-center text-lg font-bold leading-tight text-white sm:-mx-4 sm:-mt-4 sm:px-4 sm:py-3 sm:text-xl",
          canUseSuperWater(nativeLanguage) && "font-super-water",
        )}
        style={{ backgroundColor: skin.accent }}
      >
        <span>{headerDisplay}</span>
      </header>

      <div
        className={cn(
          "flex min-h-0 flex-1 flex-col justify-center py-4 text-center max-sm:py-2",
          isDailyChallenge ? "gap-1" : "",
        )}
        style={contentScale === 1 ? undefined : { transform: `scale(${contentScale})` }}
      >
        {!isDailyChallenge ? (
          <div className="flex items-center justify-center gap-2 text-base text-slate-500 max-sm:text-sm">
            <Volume2 className="size-5 shrink-0" aria-hidden="true" />
            <span>{card.pronunciation}</span>
          </div>
        ) : null}

        <h2 className={cn(
          "min-w-0 max-w-full break-words text-center font-display font-semibold leading-tight text-slate-950",
          isDailyChallenge ? "mt-3 text-4xl sm:text-5xl" : "mt-3 text-3xl sm:text-5xl",
        )}>
          {card.term}
        </h2>

        {isDailyChallenge ? (
          <p className="mt-2 break-words text-2xl font-semibold leading-tight text-slate-950/70 max-sm:text-xl sm:text-4xl">
            {translations}
          </p>
        ) : (
          <p className="mt-4 min-h-0 line-clamp-3 break-words text-2xl font-semibold leading-tight text-slate-950 max-sm:mt-3 max-sm:text-xl">
            {translations}
          </p>
        )}
      </div>

      <footer
        className="-mx-2.5 -mb-2.5 flex min-h-12 items-center px-3 py-2 text-white sm:-mx-4 sm:-mb-4 sm:px-4 sm:py-3"
        style={{ backgroundColor: skin.accent }}
      >
        <div className="flex min-h-10 w-full items-center justify-center text-center" data-card-example-row>
          <p
            className="line-clamp-2 w-full text-lg font-medium leading-6 max-sm:text-base max-sm:leading-5"
            data-card-example-preview
            title={example}
          >
            {example}
          </p>
        </div>
      </footer>
    </div>
  );
}

function CardBack({
  card,
  skin,
}: {
  card: VocabularyCard;
  skin: (typeof CARD_SKINS)[Tier];
}) {
  return (
    <div className="absolute inset-0 overflow-hidden rounded-lg border bg-white p-1.5 shadow-sm sm:p-2.5" data-card-back>
      <div
        className="flex h-full items-center justify-center overflow-hidden rounded-md text-center text-white"
        data-card-back-tier={card.tier}
        style={{ backgroundColor: skin.accent }}
      >
        <span className="font-display text-7xl font-semibold leading-none max-sm:text-6xl" data-card-back-medallion="true">
          {card.tier}
        </span>
      </div>
    </div>
  );
}
