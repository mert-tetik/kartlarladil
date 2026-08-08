"use client";

import { getPrimaryCardTranslation } from "@/features/cards/card-localization";
import { getWordOfTheDayTitle } from "@/features/twitter-automation/social-video-titles";
import { LANGUAGE_BY_CODE } from "@/data/languages";
import type { LanguageCode, VocabularyCard } from "@/types/domain";

const POSTER_TIER_PALETTES = {
  A1: { base: "#047857", deep: "#043c2d", accent: "#a7f3d0", light: "#d1fae5" },
  A2: { base: "#0369a1", deep: "#083b5c", accent: "#bae6fd", light: "#e0f2fe" },
  B1: { base: "#6331c5", deep: "#3b176f", accent: "#ddd6fe", light: "#ede9fe" },
  B2: { base: "#b45309", deep: "#642d0a", accent: "#fde68a", light: "#fef3c7" },
  C1: { base: "#be123c", deep: "#6d0c29", accent: "#fecdd3", light: "#ffe4e6" },
} as const;

type WordOfTheDayImageMode = "card" | "poster";

interface WordOfTheDayImageProps {
  card: VocabularyCard;
  nativeLanguage: LanguageCode;
  mode: WordOfTheDayImageMode;
}

export function WordOfTheDayImage({ card, nativeLanguage, mode }: WordOfTheDayImageProps) {
  const palette = POSTER_TIER_PALETTES[card.tier];
  const title = getWordOfTheDayTitle(card.language);
  const languageNative = LANGUAGE_BY_CODE[card.language].nativeName;
  const meaning = getPrimaryCardTranslation(card, nativeLanguage);
  const example = card.examples[0]?.sentence ?? card.example;
  const exampleTranslation = card.examples[0]?.translations[nativeLanguage] ?? card.exampleTranslation;

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

          <div className="flex flex-1 items-center justify-center py-6">
            <div
              className="w-full max-w-[720px] rounded-3xl p-10 text-center shadow-2xl"
              style={{ backgroundColor: "#fffaf4", color: "#1c1917" }}
            >
              <span
                className="inline-block rounded-full px-4 py-1.5 text-sm font-bold uppercase tracking-wide"
                style={{ backgroundColor: palette.base, color: "#ffffff" }}
              >
                {card.tier}
              </span>
              <h2 className="mt-5 font-display text-7xl font-semibold leading-none break-words">
                {card.term}
              </h2>
              <p className="mx-auto mt-4 max-w-xl text-3xl font-medium leading-snug" style={{ color: palette.deep }}>
                {meaning}
              </p>
              <div className="mx-auto mt-6 h-px w-40" style={{ backgroundColor: palette.accent }} aria-hidden="true" />
              <p className="mx-auto mt-6 max-w-2xl text-xl leading-relaxed" style={{ color: "#44403c" }}>
                {example}
              </p>
            </div>
          </div>

          <footer className="flex items-end justify-between">
            <p className="max-w-[75%] text-lg leading-relaxed">
              {exampleTranslation}
            </p>
            <p className="text-right text-sm font-semibold opacity-80">foxiesdeck.com</p>
          </footer>
        </div>
      </article>
    );
  }

  return (
    <article
      className="relative box-border overflow-hidden"
      style={{ width: 1080, height: 1080, backgroundColor: "#11100f" }}
      data-social-word-card
    >
      <div className="absolute inset-0 opacity-30" style={{ background: `radial-gradient(circle at 20% 30%, ${palette.base}, transparent 45%)` }} aria-hidden="true" />
      <div className="absolute inset-0 opacity-25" style={{ background: `radial-gradient(circle at 80% 70%, ${palette.accent}, transparent 40%)` }} aria-hidden="true" />

      <div className="relative z-10 flex h-full flex-col items-center justify-center p-14 text-center">
        <p className="text-sm font-bold uppercase tracking-[0.2em] text-[#ffb355]">
          FoxiesDeck · Word Card
        </p>

        <div
          className="mt-8 w-full max-w-[840px] rounded-[2rem] p-12 shadow-2xl"
          style={{ backgroundColor: "#fffaf4", color: "#1c1917" }}
        >
          <div className="flex items-center justify-center gap-3">
            <span
              className="rounded-full px-4 py-1.5 text-sm font-bold uppercase tracking-wide"
              style={{ backgroundColor: palette.base, color: "#ffffff" }}
            >
              {card.tier}
            </span>
            <span className="text-base font-medium text-[#78716c]">
              {languageNative}
            </span>
          </div>

          <h2 className="mt-8 font-display text-8xl font-semibold leading-none break-words">
            {card.term}
          </h2>
          <p className="mx-auto mt-6 max-w-2xl text-4xl font-medium leading-snug" style={{ color: palette.deep }}>
            {meaning}
          </p>

          <div className="mx-auto mt-8 h-px w-48 bg-[#d6d3d1]" aria-hidden="true" />

          <p className="mx-auto mt-8 max-w-3xl text-2xl leading-relaxed text-[#44403c]">
            {example}
          </p>
          {exampleTranslation ? (
            <p className="mx-auto mt-3 max-w-3xl text-xl leading-relaxed text-[#78716c]">
              {exampleTranslation}
            </p>
          ) : null}
        </div>

        <p className="mt-10 text-lg font-semibold text-[#ffb355]">
          {title} · foxiesdeck.com
        </p>
      </div>
    </article>
  );
}
