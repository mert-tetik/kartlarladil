import { DICTIONARIES } from "@/i18n/dictionaries";
import type { LocaleCode } from "@/types/domain";

const LOCALES = Object.keys(DICTIONARIES) as LocaleCode[];
const PROMPT_KEYS = ["quiz.recallPrompt", "quiz.learningPrompt"] as const;

describe("quiz prompt localization", () => {
  it.each(PROMPT_KEYS)("%s has a native value in every locale", (key) => {
    const englishValue = DICTIONARIES.en[key];

    for (const locale of LOCALES) {
      const value = DICTIONARIES[locale][key];

      expect(value?.trim()).not.toBe("");

      if (locale !== "en") {
        expect(value).not.toBe(englishValue);
      }
    }
  });
});
