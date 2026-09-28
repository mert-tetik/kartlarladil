import { LOCALE_CODES } from "@/data/languages";
import type { LocaleCode } from "@/types/domain";

export const CARD_TEST_LOCALE_SAMPLES: Record<LocaleCode, string> = {
  tr: "örnek",
  en: "example",
  de: "Beispiel",
  ru: "пример",
  fr: "exemple",
  es: "ejemplo",
  it: "esempio",
  pt: "exemplo",
  nl: "voorbeeld",
  pl: "przykład",
  ar: "مثال",
  ja: "例",
  ko: "예시",
  "zh-CN": "示例",
};

export function createCardTestLocaleRecord() {
  return Object.fromEntries(LOCALE_CODES.map((locale) => [locale, CARD_TEST_LOCALE_SAMPLES[locale]]));
}
