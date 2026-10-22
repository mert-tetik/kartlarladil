import type { LanguageCode, LocaleCode } from "@/types/domain";
import { createRandomCardDesignTestSample, type CardDesignTestCardSource } from "@/features/cards/card-design-test-sample";

function makeCard(
  id: string,
  language: LanguageCode,
  term: string,
  translationLocale: LocaleCode,
  translation: string,
): CardDesignTestCardSource {
  return {
    id,
    language,
    tier: "A2",
    termKind: "word",
    term,
    translations: { [translationLocale]: translation },
    translationMeaningsByLocale: { [translationLocale]: [`meaning: ${translation}`] },
    pronunciation: `${term} pronunciation`,
    partOfSpeech: "noun",
    example: `${term} in a sentence.`,
  };
}

describe("createRandomCardDesignTestSample", () => {
  it("selects a different word and switches the target and native languages", () => {
    const cards = [
      makeCard("ja-1", "ja", "komorebi", "en", "sunlight through leaves"),
      makeCard("de-1", "de", "Wanderlust", "es", "deseo de viajar"),
    ];

    const sample = createRandomCardDesignTestSample(
      cards,
      { cardId: "ja-1", learningLanguage: "ja", nativeLanguage: "en" },
      () => 0,
    );

    expect(sample).toMatchObject({
      cardId: "de-1",
      learningLanguage: "de",
      nativeLanguage: "es",
      term: "Wanderlust",
      translation: "meaning: deseo de viajar",
      tier: "A2",
    });
  });

  it("skips fixed phrases and reports an empty word catalog", () => {
    const phrase = {
      ...makeCard("phrase-1", "en", "by the way", "tr", "bu arada"),
      termKind: "fixed_phrase" as const,
    };

    expect(() => createRandomCardDesignTestSample([phrase], {}, () => 0)).toThrow(
      "The vocabulary catalog does not contain any word cards.",
    );
  });
});
