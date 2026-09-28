import { describe, expect, it, vi } from "vitest";
import { LOCALE_CODES } from "@/data/languages";
import { createCustomCardFromGenerated } from "@/features/cards/custom-card-creation";
import { generatedCardSchema } from "@/features/cards/create-card-schema";
import type { CreateCustomCardInput } from "@/features/cards/custom-card-creation";
import { createCardTestLocaleRecord } from "@/test/card-locale-samples";

describe("createCustomCardFromGenerated", () => {
  it("preserves both examples and every localized definition for custom-card saves", async () => {
    const generated = generatedCardSchema.parse({
      language: "en",
      tier: "B1",
      termKind: "word",
      term: "actually",
      partOfSpeech: "adverb",
      pronunciation: "akshıli",
      translations: createCardTestLocaleRecord(),
      examples: [
        { sentence: "Actually, the train leaves at six.", translation: "Aslında tren altıda kalkıyor." },
        { sentence: "She was actually pleased with the result.", translation: "Sonuçtan gerçekten memnun kaldı." },
      ],
      definitions: createCardTestLocaleRecord(),
      grammar: [],
    });
    const createCustomCard = vi.fn<(input: CreateCustomCardInput) => Promise<void>>().mockResolvedValue();

    await createCustomCardFromGenerated(generated, createCustomCard);

    expect(createCustomCard).toHaveBeenCalledTimes(1);
    const savedInput = createCustomCard.mock.calls[0]![0];
    expect(savedInput.draft.examples).toEqual([
      { example: "Actually, the train leaves at six.", translation: "Aslında tren altıda kalkıyor." },
      { example: "She was actually pleased with the result.", translation: "Sonuçtan gerçekten memnun kaldı." },
    ]);
    expect(savedInput.draft.definitions).toEqual(generated.definitions);
    expect(savedInput.optimisticCard.examples.map((example) => example.sentence)).toEqual(
      generated.examples.map((example) => example.sentence),
    );
    expect(Object.keys(savedInput.optimisticCard.definitionsByLocale ?? {}).sort()).toEqual(
      [...LOCALE_CODES].sort(),
    );
  });
});
