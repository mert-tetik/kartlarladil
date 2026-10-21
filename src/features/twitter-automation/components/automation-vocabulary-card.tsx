"use client";

import { Volume2 } from "lucide-react";
import { ScoreIcon } from "@/components/score-icon";
import { getCardTranslationMeanings } from "@/features/cards/card-localization";
import { getPointsForTier } from "@/features/progress/progress-stats";
import { getLanguageDisplayName, getPartOfSpeechLabel, getTierLabel } from "@/i18n/labels";
import { useLocale, useT } from "@/i18n/locale-provider";
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
  accentText: string;
  backGradient: string;
  backBorder: string;
  backText: string;
}> = {
  A1: {
    accent: "#10b981",
    border: "rgba(16, 185, 129, 0.7)",
    accentText: "#065f46",
    backGradient: "linear-gradient(135deg, #059669 0%, #10b981 52%, #047857 100%)",
    backBorder: "rgba(4, 120, 87, 0.5)",
    backText: "#047857",
  },
  A2: {
    accent: "#0ea5e9",
    border: "rgba(14, 165, 233, 0.7)",
    accentText: "#075985",
    backGradient: "linear-gradient(135deg, #0284c7 0%, #0ea5e9 52%, #1d4ed8 100%)",
    backBorder: "rgba(3, 105, 161, 0.5)",
    backText: "#0369a1",
  },
  B1: {
    accent: "#8b5cf6",
    border: "rgba(139, 92, 246, 0.7)",
    accentText: "#5b21b6",
    backGradient: "linear-gradient(135deg, #7c3aed 0%, #8b5cf6 52%, #a21caf 100%)",
    backBorder: "rgba(109, 40, 217, 0.5)",
    backText: "#6d28d9",
  },
  B2: {
    accent: "#f59e0b",
    border: "rgba(245, 158, 11, 0.7)",
    accentText: "#92400e",
    backGradient: "linear-gradient(135deg, #f59e0b 0%, #eab308 52%, #b45309 100%)",
    backBorder: "rgba(180, 83, 9, 0.5)",
    backText: "#b45309",
  },
  C1: {
    accent: "#f43f5e",
    border: "rgba(244, 63, 94, 0.7)",
    accentText: "#9f1239",
    backGradient: "linear-gradient(135deg, #e11d48 0%, #f43f5e 52%, #b91c1c 100%)",
    backBorder: "rgba(190, 18, 60, 0.5)",
    backText: "#be123c",
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
  const { locale } = useLocale();
  const translate = useT();
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
          locale={locale}
          nativeLanguage={nativeLanguage}
          skin={skin}
          contentScale={contentScale}
        />
      ) : (
        <CardBack card={card} locale={locale} flipLabel={translate("cards.flip")} skin={skin} />
      )}
    </article>
  );
}

function CardFront({
  card,
  layout,
  locale,
  nativeLanguage,
  skin,
  contentScale,
}: {
  card: VocabularyCard;
  layout: AutomationCardLayout;
  locale: LanguageCode;
  nativeLanguage: LanguageCode;
  skin: (typeof CARD_SKINS)[Tier];
  contentScale: number;
}) {
  const translations = getCardTranslationMeanings(card, nativeLanguage).slice(0, 3).join(", ");
  const example = card.examples[0]?.sentence ?? card.example;
  const points = getPointsForTier(card.tier);
  const isDailyChallenge = layout === "daily-challenge";

  return (
    <div
      className="absolute inset-0 flex min-h-0 flex-col overflow-hidden rounded-lg border bg-white p-2.5 text-slate-950 sm:p-4"
      data-card-front
      style={{ borderColor: skin.border }}
    >
      <header
        className="-mx-2.5 -mt-2.5 flex items-center justify-between gap-2 px-3 py-2 text-white sm:-mx-4 sm:-mt-4 sm:px-4 sm:py-3"
        style={{ backgroundColor: skin.accent }}
      >
        <span className="text-sm font-bold sm:text-base">
          {card.tier} · {getTierLabel(card.tier, locale)}
        </span>
      </header>

      <div
        className={cn(
          "flex min-h-0 flex-1 flex-col justify-center py-4 text-center max-sm:py-2",
          isDailyChallenge ? "gap-1" : "",
        )}
        style={contentScale === 1 ? undefined : { transform: `scale(${contentScale})` }}
      >
        {!isDailyChallenge ? (
          <>
            <div className="mb-2 flex items-center justify-center gap-2 text-xs font-semibold text-slate-500 max-sm:text-[10px]">
              <span>{getLanguageDisplayName(card.language, locale)}</span>
              <span className="inline-flex items-center gap-1" style={{ color: skin.accentText }}>
                <ScoreIcon size={14} className="size-3.5" />
                <span>{points}</span>
              </span>
            </div>
            <div className="flex items-center justify-center gap-1 text-slate-500">
              <Volume2 className="size-4 max-sm:size-3" aria-hidden="true" />
              <span className="text-sm max-sm:text-xs">{card.pronunciation}</span>
            </div>
          </>
        ) : null}

        <h2 className={cn(
          "min-w-0 max-w-full break-words text-center font-display font-semibold leading-tight text-slate-950",
          isDailyChallenge ? "mt-3 text-3xl sm:text-5xl" : "mt-3 text-2xl sm:text-4xl",
        )}>
          {card.term}
        </h2>

        {isDailyChallenge ? (
          <p className="mt-2 break-words text-xl font-semibold leading-tight text-slate-950/70 sm:text-4xl">
            {translations}
          </p>
        ) : (
          <>
            <p className="mt-3 text-sm font-semibold text-slate-500 max-sm:text-[10px]">
              {getPartOfSpeechLabel(card.termKind, locale)}
            </p>
            <p className="mt-5 min-h-0 line-clamp-3 break-words text-lg font-semibold leading-6 text-slate-950 max-sm:mt-1 max-sm:text-xs max-sm:leading-tight">
              {translations}
            </p>
          </>
        )}
      </div>

      <footer
        className="-mx-2.5 -mb-2.5 flex min-h-12 items-center px-3 py-2 text-white sm:-mx-4 sm:-mb-4 sm:px-4 sm:py-3"
        style={{ backgroundColor: skin.accent }}
      >
        <div className="flex min-h-10 w-full items-center justify-center text-center" data-card-example-row>
          <p
            className="line-clamp-2 w-full text-sm font-medium leading-5 max-sm:text-xs"
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
  locale,
  flipLabel,
  skin,
}: {
  card: VocabularyCard;
  locale: LanguageCode;
  flipLabel: string;
  skin: (typeof CARD_SKINS)[Tier];
}) {
  return (
    <div className="absolute inset-0 overflow-hidden rounded-lg border bg-white p-1.5 shadow-sm sm:p-2.5" data-card-back>
      <div
        className="relative flex h-full overflow-hidden rounded-md border p-4 text-white max-sm:p-2.5"
        data-card-back-tier={card.tier}
        style={{ background: skin.backGradient, borderColor: skin.backBorder }}
      >
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 opacity-35"
          style={{
            backgroundImage: "linear-gradient(135deg, rgba(255,255,255,0.42) 1px, transparent 1px), linear-gradient(45deg, rgba(255,255,255,0.20) 1px, transparent 1px)",
            backgroundSize: "18px 18px",
          }}
        />
        <BackPattern />
        <div className="relative flex flex-1 flex-col">
          <div className="flex items-start justify-between gap-3 text-xs font-semibold text-white/75 max-sm:text-[10px]">
            <span>{getTierLabel(card.tier, locale)}</span>
            <span>{getLanguageDisplayName(card.language, locale)}</span>
          </div>
          <div className="flex flex-1 flex-col items-center justify-center text-center">
            <div className="relative flex size-24 items-center justify-center rounded-full border border-white/80 bg-white shadow-sm max-sm:size-16" data-card-back-medallion="true">
              <span className="font-display text-5xl font-semibold leading-none max-sm:text-3xl" style={{ color: skin.backText }}>
                {card.tier}
              </span>
              <span aria-hidden="true" className="pointer-events-none absolute inset-2 rounded-full border" style={{ borderColor: skin.border }} />
            </div>
            <p className="mt-4 text-sm font-semibold text-white/95 max-sm:mt-2 max-sm:text-xs">{flipLabel}</p>
          </div>
          <div className="flex items-end justify-between gap-3 text-xs font-semibold text-white/75 max-sm:text-[10px]">
            <span>FoxiesDeck</span>
            <span>{getLanguageDisplayName(card.language, locale)}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

function BackPattern() {
  return (
    <svg aria-hidden="true" className="pointer-events-none absolute inset-0 h-full w-full text-white/70" fill="none" viewBox="0 0 240 320">
      <g stroke="currentColor" strokeWidth="1.4">
        <path d="M120 34 206 160 120 286 34 160Z" opacity="0.58" />
        <path d="M120 58 184 160 120 262 56 160Z" opacity="0.5" />
        <path d="M120 82 162 160 120 238 78 160Z" opacity="0.42" />
        <circle cx="120" cy="160" r="68" opacity="0.36" />
        <circle cx="120" cy="160" r="48" opacity="0.34" />
      </g>
      <g stroke="currentColor" strokeWidth="1.2" opacity="0.52">
        <path d="M38 46c28 10 44 27 48 52" />
        <path d="M202 46c-28 10-44 27-48 52" />
        <path d="M38 274c28-10 44-27 48-52" />
        <path d="M202 274c-28-10-44-27-48-52" />
        <path d="M72 38c5 24 21 38 48 42 27-4 43-18 48-42" />
        <path d="M72 282c5-24 21-38 48-42 27 4 43 18 48 42" />
      </g>
      <g fill="currentColor" opacity="0.32">
        <circle cx="48" cy="58" r="4" />
        <circle cx="192" cy="58" r="4" />
        <circle cx="48" cy="262" r="4" />
        <circle cx="192" cy="262" r="4" />
        <path d="M120 102 128 116 120 130 112 116Z" />
        <path d="M120 190 128 204 120 218 112 204Z" />
      </g>
    </svg>
  );
}
