import { describe, expect, it } from "vitest";
import { parseGeneratedCardBatch } from "@/features/cards/create-card-batch";
import type { CreateCardRequest } from "@/features/cards/create-card-schema";
import { createCardTestLocaleRecord } from "@/test/card-locale-samples";

const requests: CreateCardRequest[] = [
  { locale: "en", term: "serendipity", targetLanguage: "en", direction: "learning-to-native" },
  { locale: "tr", term: "sobremesa", targetLanguage: "es", direction: "learning-to-native" },
];

function card(language: "en" | "es", term: string) {
  return {
    language,
    tier: "B1",
    termKind: "word",
    term,
    partOfSpeech: "noun",
    pronunciation: "ornek",
    translations: createCardTestLocaleRecord(),
    examples: [
      { sentence: language === "es" ? `Me gusta ${term}.` : `I like ${term}.`, translation: "Example one." },
      { sentence: language === "es" ? `Busco ${term}.` : `I found ${term}.`, translation: "Example two." },
    ],
    definitions: createCardTestLocaleRecord(),
    grammar: [],
  };
}

describe("parseGeneratedCardBatch", () => {
  it("restores request order and validates each card against its own target language", () => {
    const result = parseGeneratedCardBatch(JSON.stringify({
      cards: [
        { index: 1, card: card("es", "sobremesa") },
        { index: 0, card: card("en", "serendipity") },
      ],
    }), requests);

    expect(result?.map(({ language, term }) => [language, term])).toEqual([
      ["en", "serendipity"],
      ["es", "sobremesa"],
    ]);
  });

  it("rejects omitted, duplicated, or out-of-range indexes as one failed batch", () => {
    expect(parseGeneratedCardBatch(JSON.stringify({ cards: [{ index: 0, card: card("en", "serendipity") }] }), requests)).toBeNull();
    expect(parseGeneratedCardBatch(JSON.stringify({ cards: [
      { index: 0, card: card("en", "serendipity") },
      { index: 0, card: card("en", "serendipity") },
    ] }), requests)).toBeNull();
    expect(parseGeneratedCardBatch(JSON.stringify({ cards: [
      { index: 0, card: card("en", "serendipity") },
      { index: 2, card: card("es", "sobremesa") },
    ] }), requests)).toBeNull();
  });

  it("rejects a card whose language does not match its corresponding note", () => {
    expect(parseGeneratedCardBatch(JSON.stringify({ cards: [
      { index: 0, card: card("en", "serendipity") },
      { index: 1, card: card("en", "sobremesa") },
    ] }), requests)).toBeNull();
  });
});
