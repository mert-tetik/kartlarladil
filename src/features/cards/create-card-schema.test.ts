import { describe, expect, it } from "vitest";
import { generatedCardSchema } from "@/features/cards/create-card-schema";
import { createCardTestLocaleRecord } from "@/test/card-locale-samples";

function createValidCard() {
  return {
    language: "ko",
    tier: "A2",
    termKind: "word",
    term: "버리다",
    partOfSpeech: "verb",
    pronunciation: "beorida",
    translations: createCardTestLocaleRecord(),
    examples: [
      { sentence: "쓰레기를 버렸어요.", translation: "I threw the rubbish away." },
      { sentence: "낡은 옷을 버리고 새 옷을 샀어요.", translation: "I threw away the old clothes and bought new ones." },
    ],
    definitions: createCardTestLocaleRecord(),
    grammar: [],
  };
}

describe("generated card writing-system validation", () => {
  it("accepts complete localized fields and target-language example sentences", () => {
    expect(generatedCardSchema.safeParse(createValidCard()).success).toBe(true);
  });

  it("rejects translations and definitions written in the wrong non-Latin script", () => {
    const base = createValidCard();

    expect(generatedCardSchema.safeParse({
      ...base,
      translations: { ...base.translations, ru: "slushat" },
    }).success).toBe(false);

    expect(generatedCardSchema.safeParse({
      ...base,
      definitions: { ...base.definitions, ar: "a short definition" },
    }).success).toBe(false);
  });

  it("rejects examples that ignore the target language's native script", () => {
    const base = createValidCard();

    expect(generatedCardSchema.safeParse({
      ...base,
      examples: [base.examples[0], { ...base.examples[1], sentence: "He threw the old clothes away." }],
    }).success).toBe(false);
  });
});
