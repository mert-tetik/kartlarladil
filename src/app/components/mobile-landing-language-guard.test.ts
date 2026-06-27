import { describe, expect, it } from "vitest";
import { resolveMobileLandingLanguage } from "@/app/components/mobile-landing-language-guard";
import { LANGUAGE_CODES } from "@/data/languages";
import type { LanguageCode, LocaleCode } from "@/types/domain";

describe("resolveMobileLandingLanguage", () => {
  it("keeps site locale when selected card language differs from it", () => {
    const result = resolveMobileLandingLanguage("en" as LanguageCode, "tr" as LocaleCode, "de" as LocaleCode);
    expect(result.siteLocale).toBe("tr");
    expect(result.cardLanguage).toBe("en");
  });

  it("switches site locale to browser locale when card language matches current site locale", () => {
    const result = resolveMobileLandingLanguage("en" as LanguageCode, "en" as LocaleCode, "tr" as LocaleCode);
    expect(result.siteLocale).toBe("tr");
    expect(result.cardLanguage).toBe("en");
  });

  it("picks a random different card language when browser locale also matches", () => {
    const result = resolveMobileLandingLanguage("en" as LanguageCode, "en" as LocaleCode, "en" as LocaleCode);
    expect(result.siteLocale).toBe("en");
    expect(result.cardLanguage).not.toBe("en");
    expect(LANGUAGE_CODES).toContain(result.cardLanguage);
  });

  it("never returns the same language for both site and card", () => {
    const locales: LocaleCode[] = ["tr", "en", "de", "fr", "es"];
    const languages: LanguageCode[] = ["tr", "en", "de", "fr", "es"];

    for (const locale of locales) {
      for (const language of languages) {
        const result = resolveMobileLandingLanguage(language, locale, "ja" as LocaleCode);
        expect(result.siteLocale).not.toBe(result.cardLanguage);
      }
    }
  });
});
