import { describe, expect, it } from "vitest";
import { CARD_GROUPS, CARD_GROUP_IMAGE_PATHS, getCardGroupForCard, getCardsForGroup } from "@/features/cards/card-groups";
import { VOCABULARY_CARDS } from "@/data/cards";

describe("card groups", () => {
  it("keeps stable unique group definitions with available catalog cards", () => {
    const ids = CARD_GROUPS.map((group) => group.id);

    expect(new Set(ids).size).toBe(ids.length);
    expect(CARD_GROUPS).toHaveLength(30);
    expect(CARD_GROUPS.every((group) => group.englishKeys.length > 0)).toBe(true);
    expect(CARD_GROUPS.every((group) => getCardsForGroup(group.id, "en").length > 0)).toBe(true);
    expect(CARD_GROUPS.every((group) => CARD_GROUP_IMAGE_PATHS[group.id].endsWith(`${group.id}.webp`))).toBe(true);
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
});
