"use client";

import type { ComponentProps } from "react";
import { VocabularyCardView } from "@/features/cards/components/vocabulary-card-view";
import { getPrimaryCardTranslation } from "@/features/cards/card-localization";
import { getWordOfTheDayTitle } from "@/features/twitter-automation/social-video-titles";
import { canUseSuperWater, formatSuperWaterText } from "@/lib/super-water";
import type { LanguageCode, VocabularyCard } from "@/types/domain";

const POSTER_TIER_PALETTES = {
  A1: { base: "#047857", deep: "#043c2d", accent: "#a7f3d0" },
  A2: { base: "#0369a1", deep: "#083b5c", accent: "#bae6fd" },
  B1: { base: "#6331c5", deep: "#3b176f", accent: "#ddd6fe" },
  B2: { base: "#b45309", deep: "#642d0a", accent: "#fde68a" },
  C1: { base: "#be123c", deep: "#6d0c29", accent: "#fecdd3" },
} as const;

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
      style={{ width: 1024, height: 768, backgroundColor: "#b45309" }}
      data-social-word-card
    >
      <style>{overrideStyles}</style>
      <div className="absolute inset-0 opacity-20" style={{ background: "radial-gradient(circle at 30% 30%, #f5ac27, transparent 50%)" }} aria-hidden="true" />
      <div className="absolute inset-0 opacity-15" style={{ background: "radial-gradient(circle at 70% 70%, #f97316, transparent 45%)" }} aria-hidden="true" />

      <div className="relative z-10 flex h-full flex-col items-center justify-center px-10 py-8 text-center text-white">
        <h1 className={useSuperWater ? "font-super-water text-7xl font-semibold leading-tight" : "font-display text-6xl font-semibold leading-tight"}>
          {cardTitleDisplay}
        </h1>

        <div className="mt-6 flex items-center justify-center gap-10">
          <div className="social-word-front w-[380px]">
            <VocabularyCardView {...cardViewProps(card, "front", nativeLanguage)} />
          </div>
          <div className="social-word-back w-[380px]">
            <VocabularyCardView {...cardViewProps(card, "back", nativeLanguage)} />
          </div>
        </div>
      </div>
    </article>
  );
}
