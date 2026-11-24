import type { LocaleCode } from "@/types/domain";
import type { Dictionary, TranslationKey, TranslationValues } from "./types";
export type { TranslationKey, TranslationValues };
import tr from "./locales/tr";
import en from "./locales/en";
import de from "./locales/de";
import ru from "./locales/ru";
import fr from "./locales/fr";
import es from "./locales/es";
import it from "./locales/it";
import pt from "./locales/pt";
import nl from "./locales/nl";
import pl from "./locales/pl";
import ar from "./locales/ar";
import ja from "./locales/ja";
import ko from "./locales/ko";
import zhCN from "./locales/zh-CN";

const LOCALE_OVERRIDES: Record<LocaleCode, Partial<Dictionary>> = {
  tr,
  en,
  de,
  ru,
  fr,
  es,
  it,
  pt,
  nl,
  pl,
  ar,
  ja,
  ko,
  "zh-CN": zhCN,
};

export const DICTIONARIES = Object.fromEntries(
  (Object.entries(LOCALE_OVERRIDES) as Array<[LocaleCode, Partial<Dictionary>]>).map(
    ([locale, dictionary]) => [locale, { ...en, ...dictionary }],
  ),
) as Record<LocaleCode, Dictionary>;

export function translate(locale: LocaleCode, key: TranslationKey, values?: TranslationValues) {
  const template = DICTIONARIES[locale][key] ?? DICTIONARIES.en[key] ?? tr[key];
  return interpolate(template, values);
}

export function createTranslator(locale: LocaleCode) {
  return (key: TranslationKey, values?: TranslationValues) => translate(locale, key, values);
}

function interpolate(template: string, values?: TranslationValues) {
  if (!values) {
    return template;
  }

  return template.replace(/\{(\w+)\}/g, (match, key: string) =>
    Object.prototype.hasOwnProperty.call(values, key) ? String(values[key]) : match,
  );
}
