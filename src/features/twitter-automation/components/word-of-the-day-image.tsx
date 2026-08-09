"use client";

import type { ComponentProps } from "react";
import { VocabularyCardView } from "@/features/cards/components/vocabulary-card-view";
import { getWordOfTheDayTitle } from "@/features/twitter-automation/social-video-titles";
import { LANGUAGE_BY_CODE } from "@/data/languages";
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

export function WordOfTheDayImage({ card, nativeLanguage, mode }: WordOfTheDayImageProps) {
  const palette = POSTER_TIER_PALETTES[card.tier];
  const title = getWordOfTheDayTitle(card.language);
  const languageNative = LANGUAGE_BY_CODE[card.language].nativeName;
  const example = card.examples[0]?.sentence ?? card.example;

  const overrideStyles = `
    .social-word-front [data-card-face] > div,
    .social-word-back [data-card-face] > div,
    .social-word-back [data-card-face] > div > div:nth-child(2) { transform: none !important; }
    .social-word-front [data-card-face] > div > div:nth-child(2) { display: none !important; }
    .social-word-back [data-card-face] > div > div:nth-child(1) { display: none !important; }
  `;

  if (mode === "poster") {
    return (
      <article
        className="relative box-border overflow-hidden text-white"
        style={{
          width: 1024,
          height: 768,
          background: `linear-gradient(142deg, ${palette.base} 0%, ${palette.deep} 100%)`,
        }}
        data-social-word-poster
      >
        <style>{overrideStyles}</style>
        <div className="absolute inset-0 opacity-20" style={{ backgroundColor: palette.accent }} aria-hidden="true" />
        <div className="absolute -left-20 -top-20 h-[420px] w-[420px] rounded-full opacity-20" style={{ backgroundColor: palette.accent }} aria-hidden="true" />
        <div className="absolute -bottom-24 -right-24 h-[360px] w-[360px] rounded-full opacity-15" style={{ backgroundColor: palette.deep }} aria-hidden="true" />

        <div className="relative z-10 flex h-full flex-col p-10">
          <header className="flex items-start justify-between">
            <div>
              <div className="relative h-9 w-48 overflow-hidden">
                <img alt="FoxiesDeck" className="h-full w-full object-cover object-[50%_48%]" loading="eager" src="/splash.png" />
              </div>
              <h1 className="mt-2 max-w-md font-display text-4xl font-semibold leading-tight">
                {languageNative.toUpperCase()} {title.toUpperCase()}
              </h1>
            </div>
            <div className="relative h-28 w-28 shrink-0 rotate-6">
              <img alt="" className="h-auto w-full object-contain" loading="eager" src="/mascots/mascot16.webp" />
            </div>
          </header>

          <div className="pointer-events-none absolute left-1/2 top-1/2 z-10 flex w-max -translate-x-1/2 -translate-y-1/2 items-center gap-16">
            <div className="social-word-front w-[220px]">
              <VocabularyCardView {...cardViewProps(card, "front", nativeLanguage)} />
            </div>
            <div className="social-word-back w-[220px]">
              <VocabularyCardView {...cardViewProps(card, "back", nativeLanguage)} />
            </div>
          </div>

          <div className="absolute bottom-7 left-10 z-10 max-w-[66%]">
            <p className="text-base font-semibold leading-6 text-white">{example}</p>
          </div>
        </div>
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
