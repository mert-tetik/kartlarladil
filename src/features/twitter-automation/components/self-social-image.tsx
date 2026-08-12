"use client";

import { type ComponentProps } from "react";
import { LanguageFlag } from "@/components/language-flag";
import { VocabularyCardView } from "@/features/cards/components/vocabulary-card-view";
import { getPrimaryCardTranslation } from "@/features/cards/card-localization";
import { getLanguageDisplayName } from "@/i18n/labels";
import { getNativeCaptionHeading } from "@/features/twitter-automation/social-video-titles";
import type { SelfFalseFriendsContent } from "@/features/twitter-automation/self-false-friends";
import type { SelfExampleSentencesContent } from "@/features/twitter-automation/self-example-sentences";
import type { SelfVocabularyProgressionContent } from "@/features/twitter-automation/self-vocabulary-progression";
import { canUseSuperWater, formatSuperWaterText } from "@/lib/super-water";
import { cn } from "@/lib/utils";
import type { LanguageCode, Tier, VocabularyCard } from "@/types/domain";

export type SelfSocialImageMode =
  | "self-mini-quiz"
  | "self-false-friends"
  | "self-daily-challenge"
  | "self-vocabulary-progression"
  | "self-example-sentences";

interface SelfSocialImageProps {
  mode: SelfSocialImageMode;
  cards: VocabularyCard[];
  falseFriends?: SelfFalseFriendsContent | null;
  exampleSentences?: SelfExampleSentencesContent | null;
  vocabularyProgression?: SelfVocabularyProgressionContent | null;
  learningLanguage: LanguageCode;
  nativeLanguage: LanguageCode;
}

const TIER_ACCENT = {
  A1: "#10b981",
  A2: "#38bdf8",
  B1: "#a78bfa",
  B2: "#fbbf24",
  C1: "#fb7185",
} as const;

const EXAMPLE_SENTENCE_CARD_COLORS = [
  "border-[#d9c09f] bg-[#FBE4C2]",
  "border-[#d4d4d4] bg-white",
  "border-[#d9c09f] bg-[#FBE4C2]",
] as const;

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

function SelfImageHeader({
  label,
  labelClassName,
  prominent = false,
  topClassName = "top-[84px]",
  enlarged = false,
}: {
  label: string;
  labelClassName?: string;
  prominent?: boolean;
  topClassName?: string;
  enlarged?: boolean;
}) {
  return (
    <header className={cn("absolute left-0 right-0 z-10 flex flex-col items-center", topClassName)}>
      <div className={enlarged ? "relative h-20 w-96 overflow-hidden" : prominent ? "relative h-16 w-80 overflow-hidden" : "relative h-10 w-52 overflow-hidden"}>
        <SplashLogo className="h-full w-full object-cover object-[50%_48%]" />
      </div>
      <p className={cn(enlarged ? "mt-5 text-3xl font-bold uppercase tracking-wider text-white/70" : prominent ? "mt-4 text-base font-bold uppercase tracking-wider text-white/70" : "mt-3 text-sm font-bold uppercase tracking-wider text-white/70", labelClassName)}>{label}</p>
    </header>
  );
}

function FalseFriendsPanel({ compact = false, explanation, term, tier }: { compact?: boolean; explanation: string; term: string; tier: Tier }) {
  const accent = TIER_ACCENT[tier];

  return (
    <section className="flex h-[590px] flex-col overflow-hidden rounded-2xl bg-[#f9f2e9] text-left shadow-sm">
      <div aria-hidden="true" className="h-4 shrink-0" style={{ backgroundColor: accent }} />
      <div className={cn("flex flex-1 flex-col", compact ? "p-6" : "p-9")}>
        <span className={compact ? "text-3xl font-bold tracking-wider" : "text-4xl font-bold tracking-wider"} style={{ color: accent }}>{tier}</span>
        <h2 className={cn("break-words font-display font-semibold leading-[0.95] text-[#211b17]", compact ? "mt-6 text-5xl" : "mt-7 text-6xl")}>{term}</h2>
        <div className={cn("h-px w-full", compact ? "mt-6" : "mt-8")} style={{ backgroundColor: accent }} />
        <p className={cn("font-semibold leading-snug text-[#4a4038]", compact ? "mt-6 text-3xl" : "mt-8 text-4xl")}>{explanation}</p>
      </div>
      <div aria-hidden="true" className="h-4 shrink-0" style={{ backgroundColor: accent }} />
    </section>
  );
}

function stableOrder(value: string) {
  return Array.from(value).reduce((hash, character) => ((hash * 31) + character.codePointAt(0)!) >>> 0, 0);
}

const MINI_QUIZ_QUESTION: Record<LanguageCode, (term: string) => string> = {
  tr: (term) => `“${term}” kelimesi ne anlama geliyor?`,
  en: (term) => `What does “${term}” mean?`,
  de: (term) => `Was bedeutet „${term}“?`,
  fr: (term) => `Que signifie « ${term} » ?`,
  es: (term) => `¿Qué significa “${term}”?`,
  it: (term) => `Cosa significa “${term}”?`,
  pt: (term) => `O que significa “${term}”?`,
  nl: (term) => `Wat betekent “${term}”?`,
  pl: (term) => `Co znaczy „${term}”?`,
  ru: (term) => `Что означает «${term}»?`,
  ar: (term) => `ماذا يعني “${term}”؟`,
  ja: (term) => `「${term}」の意味は何ですか？`,
  ko: (term) => `“${term}”의 의미는 무엇인가요?`,
  "zh-CN": (term) => `“${term}”是什么意思？`,
};

const MINI_QUIZ_FOOTER: Record<LanguageCode, string> = {
  tr: "Cevabını yoruma yaz",
  en: "Comment your answer",
  de: "Schreib deine Antwort in die Kommentare",
  fr: "Commente ta réponse",
  es: "Comenta tu respuesta",
  it: "Commenta la tua risposta",
  pt: "Comenta a tua resposta",
  nl: "Reageer met je antwoord",
  pl: "Napisz odpowiedź w komentarzu",
  ru: "Напиши свой ответ в комментариях",
  ar: "اكتب إجابتك في التعليقات",
  ja: "コメントで答えを書いて",
  ko: "댓글로 답을 남겨줘",
  "zh-CN": "在评论里写下你的答案",
};

const DAILY_CHALLENGE_COPY: Record<LanguageCode, {
  learnToday: (languageName: string) => string;
  addToCollection: string;
}> = {
  tr: { learnToday: (languageName) => `Bugün öğrenilecek üç ${languageName} kelime`, addToCollection: "FoxiesDeck'de koleksiyonuna ekle!" },
  en: { learnToday: (languageName) => `Three ${languageName} words to learn today`, addToCollection: "Add them to your FoxiesDeck collection!" },
  de: { learnToday: (languageName) => `Drei Wörter auf ${languageName} für heute`, addToCollection: "Füge sie deiner FoxiesDeck-Sammlung hinzu!" },
  ru: { learnToday: (languageName) => `Три слова на ${languageName} на сегодня`, addToCollection: "Добавь их в свою коллекцию FoxiesDeck!" },
  fr: { learnToday: (languageName) => `Trois mots ${languageName} à apprendre aujourd'hui`, addToCollection: "Ajoute-les à ta collection FoxiesDeck !" },
  es: { learnToday: (languageName) => `Tres palabras en ${languageName} para aprender hoy`, addToCollection: "¡Añádelas a tu colección de FoxiesDeck!" },
  it: { learnToday: (languageName) => `Tre parole in ${languageName} da imparare oggi`, addToCollection: "Aggiungile alla tua collezione FoxiesDeck!" },
  pt: { learnToday: (languageName) => `Três palavras em ${languageName} para aprender hoje`, addToCollection: "Adicione-as à sua coleção FoxiesDeck!" },
  nl: { learnToday: (languageName) => `Drie ${languageName}-woorden voor vandaag`, addToCollection: "Voeg ze toe aan je FoxiesDeck-collectie!" },
  pl: { learnToday: (languageName) => `Trzy słowa po ${languageName} na dziś`, addToCollection: "Dodaj je do swojej kolekcji FoxiesDeck!" },
  ar: { learnToday: (languageName) => `ثلاث كلمات باللغة ${languageName} لتتعلمها اليوم`, addToCollection: "أضفها إلى مجموعتك على FoxiesDeck!" },
  ja: { learnToday: (languageName) => `今日覚える${languageName}の単語3つ`, addToCollection: "FoxiesDeckのコレクションに追加しよう！" },
  ko: { learnToday: (languageName) => `오늘 배울 ${languageName} 단어 세 개`, addToCollection: "FoxiesDeck 컬렉션에 추가하세요!" },
  "zh-CN": { learnToday: (languageName) => `今天要学的三个${languageName}单词`, addToCollection: "添加到你的 FoxiesDeck 收藏！" },
};

export function SelfSocialImage({ mode, cards, falseFriends, exampleSentences, vocabularyProgression, learningLanguage, nativeLanguage }: SelfSocialImageProps) {
  if (mode === "self-false-friends" && falseFriends) {
    return (
      <article className="relative overflow-hidden bg-[#11100f] px-16 pb-16 pt-[340px] text-center text-white" style={{ width: 1080, height: 1080 }}>
        <SelfImageHeader enlarged label={getNativeCaptionHeading(nativeLanguage, "falseFriends")} topClassName="top-[94px]" />
        <div className="grid grid-cols-2 gap-8">
          <FalseFriendsPanel explanation={falseFriends.firstExplanation} term={falseFriends.firstTerm} tier={falseFriends.firstTier} />
          <FalseFriendsPanel explanation={falseFriends.secondExplanation} term={falseFriends.secondTerm} tier={falseFriends.secondTier} />
        </div>
      </article>
    );
  }

  if (mode === "self-vocabulary-progression" && vocabularyProgression) {
    const panels = [
      { term: vocabularyProgression.beginnerTerm, tier: vocabularyProgression.beginnerTier, explanation: vocabularyProgression.beginnerExplanation },
      { term: vocabularyProgression.intermediateTerm, tier: vocabularyProgression.intermediateTier, explanation: vocabularyProgression.intermediateExplanation },
      { term: vocabularyProgression.advancedTerm, tier: vocabularyProgression.advancedTier, explanation: vocabularyProgression.advancedExplanation },
    ];

    return (
      <article className="relative overflow-hidden bg-[#11100f] px-12 pb-16 pt-[348px] text-center text-white" style={{ width: 1080, height: 1080 }}>
        <div aria-hidden="true" className="absolute inset-x-0 top-0 h-[220px] bg-[#f76808]" />
        <SelfImageHeader
          enlarged
          label={getNativeCaptionHeading(nativeLanguage, "vocabularyProgression")}
          labelClassName="text-white"
          topClassName="top-[40px]"
        />
        <div className="grid grid-cols-3 gap-6">
          {panels.map((panel) => <FalseFriendsPanel compact key={panel.tier} {...panel} />)}
        </div>
      </article>
    );
  }

  if (mode === "self-mini-quiz" && cards.length >= 1) {
    const [card, ...distractors] = cards.slice(0, 4);
    const options = [getPrimaryCardTranslation(card, nativeLanguage), ...distractors.map((d) => getPrimaryCardTranslation(d, nativeLanguage))];
    const shuffled = options.slice().sort((first, second) => stableOrder(`${card.sourceKey}:${first}`) - stableOrder(`${card.sourceKey}:${second}`));
    const colors = ["#ef4444", "#22c55e", "#3b82f6", "#eab308"];
    const footer = MINI_QUIZ_FOOTER[nativeLanguage];
    const usesSuperWater = canUseSuperWater(nativeLanguage);
    const footerDisplay = usesSuperWater
      ? formatSuperWaterText(nativeLanguage, footer).toLocaleUpperCase("en-US")
      : footer;

    return (
      <article className="relative flex flex-col items-center justify-center overflow-hidden bg-[#11100f] px-16 py-10 text-center text-white" style={{ width: 1200, height: 900 }}>
        <style>{overrideStyles()}</style>
        <SelfImageHeader label="Mini Quiz" prominent />
        <h2 className="mx-auto mt-16 max-w-5xl font-display text-6xl font-semibold leading-tight">
          {MINI_QUIZ_QUESTION[nativeLanguage](card.term)}
        </h2>
        <div className="mt-10 grid w-full max-w-5xl grid-cols-2 gap-6">
          {shuffled.map((text, index) => (
            <div
              key={index}
              className="flex items-center gap-6 rounded-2xl px-10 py-10 text-left shadow-sm"
              style={{ backgroundColor: colors[index] }}
            >
              <span className="text-4xl font-bold text-white">{String.fromCharCode(65 + index)})</span>
              <span className="text-4xl font-semibold leading-tight text-white">{text}</span>
            </div>
          ))}
        </div>
        <p
          className={cn(
            "absolute inset-x-0 bottom-[76px] px-16 text-4xl font-semibold text-white/80",
            usesSuperWater && "font-super-water",
          )}
        >
          {footerDisplay}
        </p>
      </article>
    );
  }

  if (mode === "self-daily-challenge" && cards.length >= 3) {
    const [a, b, c] = cards;
    const copy = DAILY_CHALLENGE_COPY[nativeLanguage];
    const learningLanguageName = getLanguageDisplayName(a.language, nativeLanguage);
    return (
      <article className="relative flex flex-col items-center justify-center overflow-hidden bg-[#11100f] p-10 text-center text-white" style={{ width: 1080, height: 1080 }}>
        <style>{overrideStyles()}</style>
        <SelfImageHeader labelClassName="text-2xl" prominent label={getNativeCaptionHeading(nativeLanguage, "dailyChallenge")} topClassName="top-[64px]" />
        <h2 className="mx-auto mt-16 max-w-3xl font-display text-6xl font-semibold leading-tight">{copy.learnToday(learningLanguageName)}</h2>
        <div className="mt-12 flex items-start gap-6">
          {[a, b, c].map((card, index) => (
            <div key={index} className="w-[320px]">
              <div className="self-image-front">
                <VocabularyCardView {...cardViewProps(card, "front", nativeLanguage)} frontContentScale={1.2} frontTranslationBelowTerm frontHideStudyMetadata frontFitCoreText />
              </div>
            </div>
          ))}
        </div>
        <p className="relative mt-12 translate-y-12 text-5xl font-semibold text-white/80">{copy.addToCollection}</p>
      </article>
    );
  }

  if (mode === "self-example-sentences" && exampleSentences) {
    const learningLanguageIsRtl = learningLanguage === "ar";
    const nativeLanguageIsRtl = nativeLanguage === "ar";

    return (
      <article className="relative overflow-hidden bg-[#11100f] px-16 pb-10 pt-32 text-white" style={{ width: 1200, height: 900 }}>
        <div className="absolute inset-x-0 top-9 z-10 flex justify-center">
          <div className="relative h-16 w-80 overflow-hidden">
            <SplashLogo className="h-full w-full object-cover object-[50%_48%]" />
          </div>
        </div>
        <div className="mb-3 grid -translate-y-4 grid-cols-2">
          <div className="flex justify-center">
            <LanguageFlag className="h-24 w-36 rounded-xl border-white/30" code={learningLanguage} />
          </div>
          <div className="flex justify-center">
            <LanguageFlag className="h-24 w-36 rounded-xl border-white/30" code={nativeLanguage} />
          </div>
        </div>
        <div className="space-y-6">
          {exampleSentences.sentences.map((example, index) => (
            <section
              key={`${example.sentence}-${index}`}
              className={cn("grid min-h-[184px] grid-cols-2 overflow-hidden rounded-xl border text-black", EXAMPLE_SENTENCE_CARD_COLORS[index])}
            >
              <p className={cn("flex items-center justify-center border-r-4 border-[#11100f] px-10 py-8 text-center font-display text-3xl font-semibold leading-tight", learningLanguageIsRtl ? "text-right" : "text-left")} dir={learningLanguageIsRtl ? "rtl" : "ltr"}>{example.sentence}</p>
              <p className={cn("flex items-center justify-center px-10 py-8 text-center font-display text-3xl font-semibold leading-tight", nativeLanguageIsRtl ? "text-right" : "text-left")} dir={nativeLanguageIsRtl ? "rtl" : "ltr"}>{example.translation}</p>
            </section>
          ))}
        </div>
      </article>
    );
  }

  return null;
}
