import { describe, expect, it } from "vitest";
import {
  buildGrammarCacheIdentityKey,
  buildCardGrammarInstructions,
  cardGrammarRequestSchema,
  cardGrammarResponseSchema,
} from "@/features/cards/card-grammar";

describe("card grammar contract", () => {
  it("requires exactly one trusted card source", () => {
    expect(cardGrammarRequestSchema.safeParse({ nativeLocale: "tr" }).success).toBe(false);
    expect(cardGrammarRequestSchema.safeParse({ sourceKey: "en:A1:word:hello:noun", nativeLocale: "tr" }).success).toBe(true);
    expect(cardGrammarRequestSchema.safeParse({ sourceKey: "card", nativeLocale: "tr", preview: {} }).success).toBe(false);
  });

  it("accepts only the ready, pending, or failed response shapes", () => {
    expect(cardGrammarResponseSchema.safeParse({
      status: "ready",
      sections: [{ title: "Fiil türü", items: ["Geçişli fiildir."] }],
    }).success).toBe(true);
    expect(cardGrammarResponseSchema.safeParse({ status: "pending" }).success).toBe(true);
    expect(cardGrammarResponseSchema.safeParse({ status: "failed", errorCode: "grammar_generation_failed" }).success).toBe(true);
    expect(cardGrammarResponseSchema.safeParse({ status: "ready", grammarText: "Fiil kullanımı" }).success).toBe(false);
  });

  it("keeps the prompt language and term-specific grammar requirements explicit", () => {
    const prompt = buildCardGrammarInstructions({
      sourceLanguage: "ru",
      nativeLocale: "tr",
      term: "слушать",
      nativeTranslation: "dinlemek",
      partOfSpeech: "verb",
      termKind: "word",
    });

    expect(prompt).toContain("entirely in tr");
    expect(prompt).toContain("слушать");
    expect(prompt).toContain("exactly this shape: {\"sections\"");
    expect(prompt).toContain("Write every section title, explanation, label, gloss, and translation entirely in tr");
    expect(prompt).toContain("Never create a section titled 'Basic meaning'");
    expect(prompt).toContain("Never create a section titled 'Conjugation note'");
    expect(prompt).toContain("native-language equivalent of 'Word type'");
    expect(prompt).toContain("ben (I): dinlerim");
    expect(prompt).toContain("Always include a separate section titled with the native-language equivalent of 'Usage'");
    expect(prompt).toContain("always include separate sections titled with the native-language equivalents of 'Common Patterns' and 'Collocations'");
    expect(prompt).toContain("Follow normal capitalization");
    expect(prompt).toContain("short, natural, easy-to-read sentences");
    expect(prompt).toContain("State the correct verb type");
    expect(prompt).toContain("Never ask a question");
    expect(prompt).toContain("Do not repeat the vocabulary term as a section title");
    expect(prompt).toContain("Return only one JSON object");
  });

  it("uses only the term, languages, and term kind for the shared cache identity", () => {
    const first = buildGrammarCacheIdentityKey({
      sourceLanguage: "tr",
      nativeLocale: "en",
      term: "  Dinlemek  ",
      nativeTranslation: "to listen",
      partOfSpeech: "verb",
      termKind: "word",
    });
    const second = buildGrammarCacheIdentityKey({
      sourceLanguage: "tr",
      nativeLocale: "en",
      term: "dinlemek",
      nativeTranslation: "listen",
      partOfSpeech: "fiil",
      termKind: "word",
    });

    expect(first).toBe(second);
    expect(buildGrammarCacheIdentityKey({
      sourceLanguage: "tr",
      nativeLocale: "tr",
      term: "dinlemek",
      nativeTranslation: "dinlemek",
      partOfSpeech: "verb",
      termKind: "word",
    })).not.toBe(first);
  });
});
