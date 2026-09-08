import { describe, expect, it } from "vitest";
import { VOCABULARY_CARDS } from "@/data/cards";
import { findDeveloperCatalogCards } from "./developer-catalog";

describe("findDeveloperCatalogCards", () => {
  it("finds a catalog card by its source key and caps the result set", () => {
    const card = VOCABULARY_CARDS[0];
    const matches = findDeveloperCatalogCards(card.sourceKey);

    expect(matches).toContainEqual(
      expect.objectContaining({ sourceKey: card.sourceKey }),
    );
    expect(matches.length).toBeLessThanOrEqual(12);
  });

  it("does not search until the query is specific enough", () => {
    expect(findDeveloperCatalogCards("a")).toEqual([]);
  });
});
