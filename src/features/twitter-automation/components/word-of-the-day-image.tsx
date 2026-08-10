"use client";

import type { ComponentProps } from "react";
import { VocabularyCardView } from "@/features/cards/components/vocabulary-card-view";
import { getPrimaryCardTranslation } from "@/features/cards/card-localization";
import { getWordOfTheDayTitle } from "@/features/twitter-automation/social-video-titles";
import { canUseSuperWater, formatSuperWaterText } from "@/lib/super-water";
import type { LanguageCode, Tier, VocabularyCard } from "@/types/domain";

const POSTER_TIER_PALETTES = {
  A1: { base: "#047857", deep: "#043c2d", accent: "#a7f3d0" },
  A2: { base: "#0369a1", deep: "#083b5c", accent: "#bae6fd" },
  B1: { base: "#6331c5", deep: "#3b176f", accent: "#ddd6fe" },
  B2: { base: "#b45309", deep: "#642d0a", accent: "#fde68a" },
  C1: { base: "#be123c", deep: "#6d0c29", accent: "#fecdd3" },
} as const;

const TIER_ACCENT_COLORS: Record<Tier, string> = {
  A1: "#10b981",
  A2: "#0ea5e9",
  B1: "#8b5cf6",
  B2: "#f59e0b",
  C1: "#f43f5e",
};

type WordOfTheDayImageMode = "card" | "poster";

interface WordOfTheDayImageProps {
  card: VocabularyCard;
  nativeLanguage: LanguageCode;
  mode: WordOfTheDayImageMode;
}

function cardViewProps(card: VocabularyCard, face: "front" | "back", translationLocale: LanguageCode): ComponentProps<typeof VocabularyCardView> {
  return { card, face, flippable: false, frontFit: true, showActions: false, staticFace: false, translationLocale };
}

const overrideStyles = `
  .social-word-front [data-card-face] > div,
  .social-word-back [data-card-face] > div,
  .social-word-back [data-card-face] > div > div:nth-child(2) { transform: none !important; }
  .social-word-front [data-card-face] > div > div:nth-child(2) { display: none !important; }
  .social-word-back [data-card-face] > div > div:nth-child(1) { display: none !important; }
`;

export function WordOfTheDayImage({ card, nativeLanguage, mode }: WordOfTheDayImageProps) {
  const palette = POSTER_TIER_PALETTES[card.tier];
  const title = getWordOfTheDayTitle(nativeLanguage);
  const titleDisplay = canUseSuperWater(nativeLanguage)
    ? formatSuperWaterText(nativeLanguage, title).toLocaleUpperCase("en-US")
    : title.toUpperCase();
  const termDisplay = canUseSuperWater(card.language)
    ? formatSuperWaterText(card.language, card.term).toLocaleUpperCase("en-US")
    : card.term;
  const meaning = getPrimaryCardTranslation(card, nativeLanguage);
  const example = card.examples[0]?.sentence ?? card.example;
  const titleColor = TIER_ACCENT_COLORS[card.tier];

  if (mode === "poster") {
    return (
      <article
        className="relative box-border flex flex-col overflow-hidden p-12 text-white"
        style={{
          width: 1024,
          height: 768,
          background: `linear-gradient(142deg, ${palette.base} 0%, ${palette.deep} 100%)`,
        }}
        data-social-word-poster
      >
        <div className="absolute inset-0 opacity-20" style={{ backgroundColor: palette.accent }} aria-hidden="true" />
        <div className="absolute -left-20 -top-20 h-[420px] w-[420px] rounded-full opacity-20" style={{ backgroundColor: palette.accent }} aria-hidden="true" />
        <div className="absolute -bottom-24 -right-24 h-[360px] w-[360px] rounded-full opacity-15" style={{ backgroundColor: palette.deep }} aria-hidden="true" />

        <header className="relative z-10 flex items-start justify-between">
          <h1 className={canUseSuperWater(nativeLanguage) ? "font-super-water text-4xl font-semibold leading-tight" : "font-display text-4xl font-semibold leading-tight"}>
            {titleDisplay}
          </h1>
          <span className="rounded-full px-4 py-1.5 text-sm font-bold uppercase tracking-wide" style={{ backgroundColor: palette.accent, color: palette.deep }}>
            {card.tier}
          </span>
        </header>

        <main className="relative z-10 flex flex-1 flex-col items-center justify-center text-center">
          <p className="text-xl opacity-80">{card.partOfSpeech} · {card.pronunciation}</p>
          <h2 className={canUseSuperWater(card.language) ? "font-super-water mt-4 text-[8rem] font-semibold leading-[0.85]" : "font-display mt-4 text-[7rem] font-semibold leading-[0.85]"}>
            {termDisplay}
          </h2>
          <p className="mt-5 max-w-2xl text-4xl font-medium leading-snug" style={{ color: palette.accent }}>
            {meaning}
          </p>
        </main>

        <footer className="relative z-10 text-center">
          <p className="mx-auto max-w-4xl text-2xl leading-relaxed">{example}</p>
          <p className="mt-3 text-sm font-semibold opacity-70">foxiesdeck.com</p>
        </footer>
      </article>
    );
  }

  const cardTitle = getWordOfTheDayTitle(nativeLanguage);
  const useSuperWater = canUseSuperWater(nativeLanguage);
  const cardTitleDisplay = useSuperWater
    ? formatSuperWaterText(nativeLanguage, cardTitle).toLocaleUpperCase("en-US")
    : cardTitle.toUpperCase();

  return (
    <article
      className="relative box-border overflow-hidden"
      style={{ width: 1024, height: 768, backgroundColor: "#f76808" }}
      data-social-word-card
    >
      <style>{overrideStyles}</style>

      <svg aria-hidden="true" className="pointer-events-none absolute inset-0 z-0 h-full w-full" viewBox="0 0 1024 768">
        <path d="M0 0H310C420 150 342 315 225 468C153 562 146 674 205 768H0Z" fill="#FBE4C2" />
      </svg>

      <div className="relative z-10 flex h-full flex-col items-center justify-center px-10 py-8 text-center text-white">
        <h1 className={useSuperWater ? "font-super-water text-7xl font-semibold leading-tight" : "font-display text-6xl font-semibold leading-tight"} style={{ color: titleColor, WebkitTextStroke: "2px #000000" }}>
          {cardTitleDisplay}
        </h1>

        <div className="mt-5 flex items-center justify-center gap-6">
          <div className="social-word-front" style={{ width: 390 }}>
            <VocabularyCardView {...cardViewProps(card, "front", nativeLanguage)} frontContentScale={1.25} />
          </div>
          <div className="social-word-back" style={{ width: 390 }}>
            <VocabularyCardView {...cardViewProps(card, "back", nativeLanguage)} />
          </div>
        </div>
      </div>

      <img
        alt=""
        className="pointer-events-none absolute -bottom-32 -right-32 z-20 h-[560px] w-[560px] object-contain opacity-100"
        loading="eager"
        src="/mascots/mascot1.webp"
      />
    </article>
  );
}
