import Image from "next/image";
import { getLocaleDirection } from "@/i18n/config";
import { formatNumber, getLanguageDisplayName } from "@/i18n/labels";
import { canUseSuperWater, formatSuperWaterText } from "@/lib/super-water";
import { cn } from "@/lib/utils";
import type { LanguageCode } from "@/types/domain";

export type VocabularyCarouselIntroMode = "vocabulary" | "tier";

type VocabularyCarouselIntroProps = {
  learningLanguage: LanguageCode;
  nativeLanguage: LanguageCode;
  mode: VocabularyCarouselIntroMode;
  wordCount: number;
  onSlideRef?: (element: HTMLDivElement | null) => void;
};

const VOCABULARY_PRACTICE_TITLE: Record<LanguageCode, string> = {
  tr: "Kelime Pratiği",
  en: "Vocabulary Practice",
  de: "Wortschatztraining",
  ru: "Практика словарного запаса",
  fr: "Pratique du vocabulaire",
  es: "Práctica de vocabulario",
  it: "Pratica del vocabolario",
  pt: "Prática de vocabulário",
  nl: "Woordenschatoefening",
  pl: "Ćwiczenie słownictwa",
  ar: "تدريب المفردات",
  ja: "語彙練習",
  ko: "어휘 연습",
  "zh-CN": "词汇练习",
};

const RANDOM_WORDS_DESCRIPTION: Record<LanguageCode, (count: string, language: string) => string> = {
  tr: (count, language) => count + " rastgele " + language + " kelime",
  en: (count, language) => count + " random " + language + " words",
  de: (count, language) => count + " zufällige Wörter auf " + language,
  ru: (count, language) => count + " случайных слов на " + language,
  fr: (count, language) => count + " mots aléatoires en " + language,
  es: (count, language) => count + " palabras al azar en " + language,
  it: (count, language) => count + " parole casuali in " + language,
  pt: (count, language) => count + " palavras aleatórias em " + language,
  nl: (count, language) => count + " willekeurige woorden in het " + language,
  pl: (count, language) => count + " losowych słów po " + language,
  ar: (count, language) => count + " كلمات عشوائية باللغة " + language,
  ja: (count, language) => language + "のランダム単語" + count + "個",
  ko: (count, language) => "무작위 " + language + " 단어 " + count + "개",
  "zh-CN": (count, language) => count + " 个随机" + language + "单词",
};

const TIER_PROGRESS_DESCRIPTION: Record<LanguageCode, (count: string) => string> = {
  tr: (count) => "A1'den C1'e rastgele " + count + " kelime",
  en: (count) => count + " random words from A1 to C1",
  de: (count) => count + " zufällige Wörter von A1 bis C1",
  ru: (count) => count + " случайных слов от A1 до C1",
  fr: (count) => count + " mots aléatoires de A1 à C1",
  es: (count) => count + " palabras al azar de A1 a C1",
  it: (count) => count + " parole casuali da A1 a C1",
  pt: (count) => count + " palavras aleatórias de A1 a C1",
  nl: (count) => count + " willekeurige woorden van A1 tot C1",
  pl: (count) => count + " losowych słów od A1 do C1",
  ar: (count) => count + " كلمات عشوائية من A1 إلى C1",
  ja: (count) => "A1からC1までランダムな" + count + "単語",
  ko: (count) => "A1부터 C1까지 무작위 단어 " + count + "개",
  "zh-CN": (count) => "从 A1 到 C1 的 " + count + " 个随机单词",
};

export function VocabularyCarouselIntro({
  learningLanguage,
  nativeLanguage,
  mode,
  wordCount,
  onSlideRef,
}: VocabularyCarouselIntroProps) {
  const count = formatNumber(nativeLanguage, wordCount);
  const learningLanguageLabel = getLanguageDisplayName(learningLanguage, nativeLanguage);
  const title = VOCABULARY_PRACTICE_TITLE[nativeLanguage];
  const usesSuperWater = canUseSuperWater(nativeLanguage);
  const titleDisplay = usesSuperWater
    ? formatSuperWaterText(nativeLanguage, title).toLocaleUpperCase("en-US")
    : title;
  const subtitle = mode === "tier"
    ? TIER_PROGRESS_DESCRIPTION[nativeLanguage](count)
    : RANDOM_WORDS_DESCRIPTION[nativeLanguage](count, learningLanguageLabel);

  return (
    <article
      className="relative aspect-[3/4] w-[360px] shrink-0 overflow-hidden bg-[#f76808] text-white sm:w-[440px]"
      data-social-vocabulary-carousel-intro
      dir={getLocaleDirection(nativeLanguage)}
      ref={onSlideRef}
    >
      <div aria-hidden="true" className="absolute inset-x-0 top-0 h-7 bg-[#fbe4c2] sm:h-8" />
      <div aria-hidden="true" className="absolute inset-x-0 bottom-0 h-7 bg-[#fbe4c2] sm:h-8" />
      <div className="absolute inset-0 grid place-items-center px-8 sm:px-10">
        <div className="flex w-full max-w-[23rem] -translate-y-12 flex-col items-center text-center sm:max-w-[26rem]">
        <Image alt="FoxiesDeck" className="h-auto w-56 object-contain sm:w-64" height={158} priority src="/splash.png" unoptimized width={256} />
        <h1 className={cn("-mt-14 max-w-[20rem] font-sans text-5xl font-bold leading-[0.95] text-[#fbe4c2] sm:max-w-[23rem] sm:text-6xl", usesSuperWater && "font-super-water")}>
          {titleDisplay}
        </h1>
        <p className="mt-9 max-w-[19rem] text-2xl font-semibold leading-tight text-white sm:max-w-[23rem] sm:text-3xl">
          {subtitle}
        </p>
        </div>
      </div>
    </article>
  );
}
