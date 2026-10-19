import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { SelfSocialImage, type SelfSocialImageMode } from "./self-social-image";
import type { SelfFalseFriendsContent } from "@/features/twitter-automation/self-false-friends";
import type { SelfExampleSentencesContent } from "@/features/twitter-automation/self-example-sentences";
import type { SelfVocabularyProgressionContent } from "@/features/twitter-automation/self-vocabulary-progression";
import type { VocabularyCard } from "@/types/domain";

vi.mock("@/components/language-flag", () => ({
  LanguageFlag: () => <span data-testid="language-flag" />,
}));

vi.mock("@/features/cards/components/vocabulary-card-view", () => ({
  VocabularyCardView: () => <div data-testid="vocabulary-card" />,
}));

const testCard = {
  sourceKey: "self-image-test-card",
  language: "es",
  tier: "A1",
  term: "hola",
  translation: "hello",
  translations: { en: "hello", tr: "merhaba" },
  translationMeaningsByLocale: {},
  examples: [],
} as unknown as VocabularyCard;

const falseFriends: SelfFalseFriendsContent = {
  firstTerm: "actual",
  secondTerm: "current",
  firstTier: "B1",
  secondTier: "A2",
  firstExplanation: "Existing first explanation",
  secondExplanation: "Existing second explanation",
};

const vocabularyProgression: SelfVocabularyProgressionContent = {
  beginnerTerm: "beginner",
  intermediateTerm: "intermediate",
  advancedTerm: "advanced",
  beginnerTier: "A1",
  intermediateTier: "B2",
  advancedTier: "C1",
  beginnerExplanation: "Beginner meaning",
  intermediateExplanation: "Intermediate meaning",
  advancedExplanation: "Advanced meaning",
};

const exampleSentences: SelfExampleSentencesContent = {
  sentences: [
    { sentence: "Example one.", translation: "Translation one." },
    { sentence: "Example two.", translation: "Translation two." },
    { sentence: "Example three.", translation: "Translation three." },
  ],
};

const backgroundByMode: Record<SelfSocialImageMode, string> = {
  "self-mini-quiz": "/social/self-image-backgrounds/self-mini-quiz-background.webp",
  "self-false-friends": "/social/self-image-backgrounds/self-false-friends-background.webp",
  "self-daily-challenge": "/social/self-image-backgrounds/self-daily-challenge-background.webp",
  "self-vocabulary-progression": "/social/self-image-backgrounds/self-vocabulary-progression-background.webp",
  "self-example-sentences": "/social/self-image-backgrounds/self-example-sentences-background.webp",
};

afterEach(() => cleanup());

describe("SelfSocialImage backgrounds", () => {
  it.each(Object.entries(backgroundByMode) as [SelfSocialImageMode, string][])(
    "%s loads its own background behind the content",
    (mode, expectedSource) => {
      const cards = Array.from({ length: mode === "self-mini-quiz" ? 4 : 3 }, (_, index) => ({
        ...testCard,
        sourceKey: `${testCard.sourceKey}-${index}`,
      })) as VocabularyCard[];
      const { container } = render(
        <SelfSocialImage
          cards={cards}
          exampleSentences={mode === "self-example-sentences" ? exampleSentences : null}
          falseFriends={mode === "self-false-friends" ? falseFriends : null}
          learningLanguage="es"
          mode={mode}
          nativeLanguage="en"
          vocabularyProgression={mode === "self-vocabulary-progression" ? vocabularyProgression : null}
        />,
      );

      const article = container.querySelector("article");
      const background = article?.firstElementChild;

      expect(article).toHaveClass("isolate");
      expect(background).toHaveAttribute("src", expectedSource);
      expect(background).toHaveAttribute("aria-hidden", "true");
      expect(background).toHaveStyle({ zIndex: "-1" });
    },
  );
});
