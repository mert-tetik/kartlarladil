import { DICTIONARIES } from "@/i18n/dictionaries";
import type { TranslationKey } from "@/i18n/dictionaries";

const RU_LOCALIZED_KEYS = [
  "account.subscription.mismatch.twaWithLemon",
  "auth.mobile.useEmailInstead",
  "auth.mobile.welcomeTitle",
  "auth.validation.languageSameAsLocale",
  "cards.createCard",
  "common.delete",
  "common.retry",
  "inventory.deleteConfirm",
  "limit.activeCardLimitDescription",
  "limit.learnedCardLimitDescription",
  "page.aiPractice.tierSelectionTitle",
  "pricing.mismatch.twaWithLemon",
  "pricing.googlePlayUnavailable",
  "quiz.countAvailable",
  "quiz.countLabel",
  "quiz.aiValidating",
  "home.mobile.selectLanguage",
  "home.mobile.startLearning",
  "home.mobile.missions",
  "createCard.generate",
  "createCard.error.unknown",
  "push.prompt.title",
  "push.settings.title",
  "games.wordMatch.title",
  "missions.title",
  "missions.type.addCards",
] as const satisfies readonly TranslationKey[];

describe("Russian UI dictionary", () => {
  it("does not contain mojibake or unresolved placeholder markers", () => {
    for (const value of Object.values(DICTIONARIES.ru)) {
      expect(value).not.toMatch(/[ĞÑÂ]/);
      expect(value).not.toMatch(/\?{4,}/);
    }
  });

  it.each(RU_LOCALIZED_KEYS)("%s is localized in Russian", (key) => {
    expect(DICTIONARIES.ru[key]).not.toBe(DICTIONARIES.en[key]);
  });
});
