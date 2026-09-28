import { describe, expect, it } from "vitest";
import { CARD_GROUPS, CARD_GROUP_IMAGE_PATHS, getCardGroupForCard, getCardsForGroup } from "@/features/cards/card-groups";
import { VOCABULARY_CARDS } from "@/data/cards";
import { CARD_PRONUNCIATIONS } from "@/data/card-pronunciations.generated";
import { ADDITIONAL_CARD_KEYS } from "@/data/card-seeds/additional-card-entries";
import { masterCardEntries } from "@/data/card-seeds/master-list";
import { LOCALE_CODES } from "@/data/languages";

describe("card groups", () => {
  it("keeps stable unique group definitions with available catalog cards", () => {
    const ids = CARD_GROUPS.map((group) => group.id);

    expect(new Set(ids).size).toBe(ids.length);
    expect(CARD_GROUPS).toHaveLength(50);
    expect(CARD_GROUPS.every((group) => group.englishKeys.length > 0)).toBe(true);
    expect(CARD_GROUPS.every((group) => getCardsForGroup(group.id, "en").length > 0)).toBe(true);
    expect(CARD_GROUPS.every((group) => /^\/card-groups\/.+\.webp$/.test(CARD_GROUP_IMAGE_PATHS[group.id]))).toBe(true);
  });

  it("matches groups by the shared English lemma while returning the selected language", () => {
    const schoolCards = getCardsForGroup("school", "tr");

    expect(schoolCards.length).toBeGreaterThan(0);
    expect(schoolCards.every((card) => card.language === "tr")).toBe(true);
    expect(schoolCards.some((card) => card.englishKey === "school")).toBe(true);
  });

  it("does not return custom or other-language cards", () => {
    const technologyCards = getCardsForGroup("technology", "en");

    expect(technologyCards.every((card) => card.language === "en")).toBe(true);
    expect(technologyCards.every((card) => card.sourceKey.startsWith("en:"))).toBe(true);
  });

  it("resolves a catalog card to its group artwork", () => {
    const schoolCard = VOCABULARY_CARDS.find((card) => card.language === "en" && card.englishKey === "school");

    expect(schoolCard).toBeDefined();
    expect(getCardGroupForCard(schoolCard!)).toMatchObject({ id: "school" });
  });

  it("keeps every manually added lemma complete in every language", () => {
    const masterKeys = new Set<string>(masterCardEntries.map((row) => String(row[0])));

    expect([...ADDITIONAL_CARD_KEYS].every((key) => !masterKeys.has(key))).toBe(true);

    for (const englishKey of ADDITIONAL_CARD_KEYS) {
      expect(CARD_GROUPS.some((group) => group.englishKeys.some((key) => key === englishKey))).toBe(true);

      for (const language of LOCALE_CODES) {
        const card = VOCABULARY_CARDS.find(
          (candidate) => candidate.language === language && candidate.englishKey === englishKey,
        );

        expect(card, `${language}:${englishKey}`).toBeDefined();
        expect(card?.pronunciation.trim(), `${language}:${englishKey} pronunciation`).not.toBe("");
        expect(CARD_PRONUNCIATIONS[card!.sourceKey], `${language}:${englishKey} pronunciation map`).toBe(
          card!.pronunciation,
        );
        expect(card?.examples).toHaveLength(2);
        expect(new Set(card?.examples.map((example) => example.sentence.trim())).size).toBe(2);
      }
    }
  });
});
