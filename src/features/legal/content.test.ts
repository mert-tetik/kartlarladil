import { describe, expect, it } from "vitest";
import {
  getLegalContent,
  legalContent,
  type LegalSection,
} from "@/features/legal/content";
import type { LocaleCode } from "@/types/domain";

const locales: LocaleCode[] = ["tr", "en", "de", "ru", "fr", "es", "it", "pt", "nl", "pl", "ar", "ja", "ko", "zh-CN"];
const sections: LegalSection[] = ["terms", "privacy", "refund", "cookies", "subscriptions"];

describe("legal content", () => {
  it("provides five non-empty localized pages for every supported locale", () => {
    for (const locale of locales) {
      for (const section of sections) {
        const content = getLegalContent(locale, section);

        expect(content, `${locale}/${section}`).toContain("<h2>");
        expect(content, `${locale}/${section}`).not.toMatch(/Lemon\s*Squeezy/i);
      }
    }
  });

  it("does not silently reuse English legal content for other locales", () => {
    for (const locale of locales.filter((value) => value !== "en")) {
      expect(legalContent[locale].privacy).not.toBe(legalContent.en.privacy);
      expect(legalContent[locale].terms).not.toBe(legalContent.en.terms);
    }
  });

  it("discloses current analytics, AI, push, leaderboard and Google Play flows", () => {
    for (const locale of locales) {
      const privacy = getLegalContent(locale, "privacy");

      expect(privacy, `${locale}/privacy`).toContain("Firebase/Google Analytics");
      expect(privacy, `${locale}/privacy`).toContain("OpenAI");
      expect(privacy, `${locale}/privacy`).toContain("Google Play");
      expect(privacy, `${locale}/privacy`).toContain("TWA");
      expect(privacy, `${locale}/privacy`).toMatch(/push/i);
      expect(privacy, `${locale}/privacy`).toMatch(/OCR/i);
    }
  });

  it("includes official Google Play destinations in subscription and refund pages", () => {
    for (const locale of locales) {
      expect(getLegalContent(locale, "subscriptions"), `${locale}/subscriptions`).toContain(
        "play.google.com/store/account/subscriptions",
      );
      expect(getLegalContent(locale, "refund"), `${locale}/refund`).toContain(
        "support.google.com/googleplay/answer/15574908",
      );
    }
  });
});
