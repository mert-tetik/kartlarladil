import localizedStatusCopy from "./native-loading-status-copy.json";
import type { LocaleCode } from "@/types/domain";

const NATIVE_LOADING_STATUS_COPY = localizedStatusCopy as Record<LocaleCode, readonly string[]>;

export function getNativeLoadingStatuses(locale: LocaleCode, random: () => number = Math.random) {
  const candidates = [...(NATIVE_LOADING_STATUS_COPY[locale] ?? NATIVE_LOADING_STATUS_COPY.en)];

  for (let index = candidates.length - 1; index > 0; index -= 1) {
    const randomIndex = Math.min(index, Math.max(0, Math.floor(random() * (index + 1))));
    [candidates[index], candidates[randomIndex]] = [candidates[randomIndex], candidates[index]];
  }

  return candidates.slice(0, 8);
}

const NATIVE_LOADING_TITLE_COPY: Record<LocaleCode, string> = {
  tr: "Günün Kelimeleri",
  en: "Words of the Day",
  de: "Wörter des Tages",
  ru: "Слова дня",
  fr: "Mots du jour",
  es: "Palabras del día",
  it: "Parole del giorno",
  pt: "Palavras do dia",
  nl: "Woorden van de dag",
  pl: "Słowa dnia",
  ar: "كلمات اليوم",
  ja: "今日の言葉",
  ko: "오늘의 단어",
  "zh-CN": "每日单词",
};

export function getNativeLoadingTitle(locale: LocaleCode) {
  return NATIVE_LOADING_TITLE_COPY[locale] ?? NATIVE_LOADING_TITLE_COPY.en;
}
