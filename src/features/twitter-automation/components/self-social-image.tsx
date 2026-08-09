"use client";

import { useMemo, type ComponentProps } from "react";
import { VocabularyCardView } from "@/features/cards/components/vocabulary-card-view";
import { getPrimaryCardTranslation } from "@/features/cards/card-localization";
import { LANGUAGE_BY_CODE } from "@/data/languages";
import type { LanguageCode, VocabularyCard } from "@/types/domain";

export type SelfSocialImageMode =
  | "self-mini-quiz"
  | "self-false-friends"
  | "self-daily-challenge"
  | "self-vocabulary-progression"
  | "self-example-sentences";

interface SelfSocialImageProps {
  mode: SelfSocialImageMode;
  cards: VocabularyCard[];
  nativeLanguage: LanguageCode;
}

const TIER_ACCENT = {
  A1: "#10b981",
  A2: "#38bdf8",
  B1: "#a78bfa",
  B2: "#fbbf24",
  C1: "#fb7185",
} as const;

function cardViewProps(card: VocabularyCard, face: "front" | "back", translationLocale: LanguageCode): ComponentProps<typeof VocabularyCardView> {
  return { card, face, flippable: false, frontFit: true, showActions: false, staticFace: false, translationLocale };
}

function overrideStyles() {
  return `
    .self-image-front [data-card-face] > div,
    .self-image-back [data-card-face] > div,
    .self-image-back [data-card-face] > div > div:nth-child(2) { transform: none !important; }
    .self-image-front [data-card-face] > div > div:nth-child(2) { display: none !important; }
    .self-image-back [data-card-face] > div > div:nth-child(1) { display: none !important; }
  `;
}

function SplashLogo({ className }: { className?: string }) {
  return <img alt="FoxiesDeck" className={className} loading="eager" src="/splash.png" />;
}

function SelfImageHeader({ label }: { label: string }) {
  return (
    <header className="absolute left-0 right-0 top-10 z-10 flex flex-col items-center">
      <div className="relative h-10 w-52 overflow-hidden">
        <SplashLogo className="h-full w-full object-cover object-[50%_48%]" />
      </div>
      <p className="mt-3 text-sm font-bold uppercase tracking-[0.25em] text-white/70">{label}</p>
    </header>
  );
}

function QuizOption({ label, text, color }: { label: string; text: string; color: string }) {
  return (
    <div
      className="flex items-center gap-3 rounded-xl px-5 py-4 text-left shadow-lg"
      style={{ backgroundColor: color, color: "#1c1917" }}
    >
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white/80 font-bold">{label}</span>
      <span className="text-lg font-semibold leading-tight">{text}</span>
    </div>
  );
}

export function SelfSocialImage({ mode, cards, nativeLanguage }: SelfSocialImageProps) {
  const languageName = useMemo(() => LANGUAGE_BY_CODE[cards[0]?.language ?? "en"].nativeName, [cards]);

  if (mode === "self-mini-quiz" && cards.length >= 1) {
    const [card, ...distractors] = cards.slice(0, 4);
    const options = [getPrimaryCardTranslation(card, nativeLanguage), ...distractors.map((d) => getPrimaryCardTranslation(d, nativeLanguage))];
    const shuffled = useMemo(() => options.slice().sort(() => Math.random() - 0.5), [options]);
    const colors = ["#ef4444", "#22c55e", "#3b82f6", "#eab308"];

    return (
      <article className="relative flex flex-col items-center justify-center overflow-hidden bg-[#11100f] p-10 text-center text-white" style={{ width: 1080, height: 1080 }}>
        <style>{overrideStyles()}</style>
        <SelfImageHeader label="Mini Quiz" />
        <h2 className="mx-auto mt-16 max-w-2xl font-display text-6xl font-semibold leading-tight">What does &ldquo;{card.term}&rdquo; mean?</h2>
        <div className="mx-auto mt-8 w-[280px]">
          <div className="self-image-front">
            <VocabularyCardView {...cardViewProps(card, "front", nativeLanguage)} />
          </div>
        </div>
        <div className="mt-10 grid w-full max-w-3xl grid-cols-2 gap-5">
          {shuffled.map((text, index) => (
            <QuizOption key={index} label={String.fromCharCode(65 + index)} text={text} color={colors[index]} />
          ))}
        </div>
        <p className="mt-10 text-lg font-semibold text-white/80">Comment your answer</p>
      </article>
    );
  }

  if (mode === "self-false-friends" && cards.length >= 2) {
    const [first, second] = cards;
    return (
      <article className="relative flex flex-col items-center justify-center overflow-hidden bg-[#11100f] p-10 text-center text-white" style={{ width: 1080, height: 1080 }}>
        <style>{overrideStyles()}</style>
        <SelfImageHeader label="Easy to Confuse" />
        <h2 className="mx-auto mt-16 max-w-3xl font-display text-6xl font-semibold leading-tight">Look Similar · Mean Different</h2>
        <div className="mt-12 flex items-center gap-12">
          <div className="w-[280px]">
            <div className="self-image-front">
              <VocabularyCardView {...cardViewProps(first, "front", nativeLanguage)} />
            </div>
            <p className="mt-4 text-2xl font-semibold" style={{ color: TIER_ACCENT[first.tier] }}>{getPrimaryCardTranslation(first, nativeLanguage)}</p>
          </div>
          <div className="text-5xl font-bold text-white/70">VS</div>
          <div className="w-[280px]">
            <div className="self-image-front">
              <VocabularyCardView {...cardViewProps(second, "front", nativeLanguage)} />
            </div>
            <p className="mt-4 text-2xl font-semibold" style={{ color: TIER_ACCENT[second.tier] }}>{getPrimaryCardTranslation(second, nativeLanguage)}</p>
          </div>
        </div>
        <p className="mt-14 text-lg font-semibold text-white/80">Can you tell the difference?</p>
      </article>
    );
  }

  if (mode === "self-daily-challenge" && cards.length >= 3) {
    const [a, b, c] = cards;
    return (
      <article className="relative flex flex-col items-center justify-center overflow-hidden bg-[#11100f] p-10 text-center text-white" style={{ width: 1080, height: 1080 }}>
        <style>{overrideStyles()}</style>
        <SelfImageHeader label="Daily Challenge" />
        <h2 className="mx-auto mt-16 max-w-3xl font-display text-6xl font-semibold leading-tight">Three {languageName} words to learn today</h2>
        <div className="mt-12 flex items-start gap-8">
          {[a, b, c].map((card, index) => (
            <div key={index} className="w-[240px]">
              <div className="self-image-front">
                <VocabularyCardView {...cardViewProps(card, "front", nativeLanguage)} />
              </div>
            </div>
          ))}
        </div>
        <p className="mt-12 text-lg font-semibold text-white/80">Add them to your collection</p>
      </article>
    );
  }

  if (mode === "self-vocabulary-progression" && cards.length >= 3) {
    const [beginner, intermediate, advanced] = cards;
    const labels = [
      { label: "Beginner", tier: beginner.tier },
      { label: "Intermediate", tier: intermediate.tier },
      { label: "Advanced", tier: advanced.tier },
    ];
    return (
      <article className="relative flex flex-col items-center justify-center overflow-hidden bg-[#11100f] p-10 text-center text-white" style={{ width: 1080, height: 1080 }}>
        <style>{overrideStyles()}</style>
        <SelfImageHeader label="Beginner to Advanced" />
        <h2 className="mx-auto mt-16 max-w-3xl font-display text-6xl font-semibold leading-tight">Level up your {languageName} vocabulary</h2>
        <div className="mt-12 flex items-start gap-8">
          {[beginner, intermediate, advanced].map((card, index) => (
            <div key={index} className="w-[240px]">
              <p className="mb-3 text-sm font-bold uppercase tracking-wide" style={{ color: TIER_ACCENT[labels[index].tier] }}>{labels[index].label}</p>
              <div className="self-image-front">
                <VocabularyCardView {...cardViewProps(card, "front", nativeLanguage)} />
              </div>
            </div>
          ))}
        </div>
        <p className="mt-12 text-lg font-semibold text-white/80">Upgrade one word at a time</p>
      </article>
    );
  }

  if (mode === "self-example-sentences" && cards.length >= 3) {
    return (
      <article className="relative flex flex-col items-center justify-start overflow-hidden bg-[#11100f] p-12 text-white" style={{ width: 1080, height: 1080 }}>
        <style>{overrideStyles()}</style>
        <SelfImageHeader label="Example Sentences" />
        <h2 className="mx-auto mt-16 max-w-3xl text-center font-display text-5xl font-semibold leading-tight">Three real {languageName} sentences</h2>
        <div className="mt-10 w-full max-w-4xl space-y-6">
          {cards.slice(0, 3).map((card, index) => (
            <div key={index} className="rounded-2xl border-2 bg-[#1b1714] p-6 shadow-sm" style={{ borderColor: TIER_ACCENT[card.tier] }}>
              <div className="flex items-start gap-6">
                <div className="w-[140px] shrink-0">
                  <div className="self-image-front scale-[0.55] origin-top-left">
                    <VocabularyCardView {...cardViewProps(card, "front", nativeLanguage)} />
                  </div>
                </div>
                <div className="flex-1">
                  <p className="text-2xl font-semibold leading-snug">{card.examples[0]?.sentence ?? card.example}</p>
                  <p className="mt-2 text-xl text-white/70">{card.examples[0]?.translations[nativeLanguage] ?? card.exampleTranslation}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
        <p className="mt-8 text-lg font-semibold text-white/80">Write your own sentence in the comments</p>
      </article>
    );
  }

  return null;
}
