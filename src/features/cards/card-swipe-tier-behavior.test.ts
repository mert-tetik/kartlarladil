import { describe, expect, it } from "vitest";
import {
  CARD_SWIPE_TIER_BEHAVIOR_MAX_HISTORY,
  CARD_SWIPE_TIER_BEHAVIOR_MIN_HISTORY,
  getCardSwipeTierBehaviorStorageKey,
  getCardSwipeTierRepeatCounts,
  readCardSwipeTierBehavior,
  recordCardSwipeTierAdded,
} from "@/features/cards/card-swipe-tier-behavior";
import type { Tier } from "@/types/domain";

function createStorage() {
  const values = new Map<string, string>();
  return {
    values,
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => values.set(key, value),
  };
}

describe("card swipe tier behavior", () => {
  it("isolates behavior by owner and learning language", () => {
    const storage = createStorage();

    recordCardSwipeTierAdded(storage, "user-1", "en", "A2");
    recordCardSwipeTierAdded(storage, "user-1", "de", "B1");
    recordCardSwipeTierAdded(storage, "user-2", "en", "C1");
    recordCardSwipeTierAdded(storage, null, "en", "A1");

    expect(readCardSwipeTierBehavior(storage, "user-1", "en").recentAddedTiers).toEqual(["A2"]);
    expect(readCardSwipeTierBehavior(storage, "user-1", "de").recentAddedTiers).toEqual(["B1"]);
    expect(readCardSwipeTierBehavior(storage, "user-2", "en").recentAddedTiers).toEqual(["C1"]);
    expect(readCardSwipeTierBehavior(storage, undefined, "en").recentAddedTiers).toEqual(["A1"]);
  });

  it("falls back to the standard weights when storage is malformed", () => {
    const storage = createStorage();
    storage.setItem(getCardSwipeTierBehaviorStorageKey("user-1", "en"), "not-json");

    expect(getCardSwipeTierRepeatCounts(storage, "user-1", "en")).toEqual({
      A1: 1,
      A2: 1,
      B1: 1,
      B2: 1,
      C1: 1,
    });
  });

  it("keeps only the last 40 added tiers", () => {
    const storage = createStorage();
    const tiers: Tier[] = Array.from({ length: CARD_SWIPE_TIER_BEHAVIOR_MAX_HISTORY + 5 }, (_, index) => (
      index % 2 === 0 ? "A1" : "C1"
    ));

    for (const tier of tiers) {
      recordCardSwipeTierAdded(storage, "user-1", "en", tier);
    }

    const history = readCardSwipeTierBehavior(storage, "user-1", "en").recentAddedTiers;
    expect(history).toHaveLength(CARD_SWIPE_TIER_BEHAVIOR_MAX_HISTORY);
    expect(history).toEqual(tiers.slice(-CARD_SWIPE_TIER_BEHAVIOR_MAX_HISTORY));
  });

  it("does not bias the first five additions", () => {
    const storage = createStorage();
    for (let index = 0; index < CARD_SWIPE_TIER_BEHAVIOR_MIN_HISTORY - 1; index += 1) {
      recordCardSwipeTierAdded(storage, "user-1", "en", "A2");
    }

    expect(getCardSwipeTierRepeatCounts(storage, "user-1", "en")).toEqual({
      A1: 1,
      A2: 1,
      B1: 1,
      B2: 1,
      C1: 1,
    });
  });

  it("allows one or two extra copies but never more than two extra copies", () => {
    const storage = createStorage();
    for (const tier of ["A1", "A1", "A1", "A1", "A2", "A2", "A2", "B1", "B2", "C1"] as Tier[]) {
      recordCardSwipeTierAdded(storage, "user-1", "en", tier);
    }

    expect(getCardSwipeTierRepeatCounts(storage, "user-1", "en")).toEqual({
      A1: 3,
      A2: 2,
      B1: 1,
      B2: 1,
      C1: 1,
    });
  });
});
