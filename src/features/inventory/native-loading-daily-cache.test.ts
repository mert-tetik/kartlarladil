import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  getOrCreateNativeLoadingDailyDeckCards,
  readNativeLoadingDailyDeckCards,
  saveNativeLoadingDailyDeckCards,
} from "@/features/inventory/native-loading-daily-cache";
import type { NativeLoadingCard } from "@/features/inventory/native-loading-cards";

const identity = {
  profileId: "user-1",
  learningLanguage: "en" as const,
  locale: "tr" as const,
  dateKey: "2026-11-05",
};

function createCard(index: number): NativeLoadingCard {
  return {
    sourceKey: `en:word:sample-${index}`,
    term: `sample-${index}`,
    translation: `örnek-${index}`,
    pronunciation: `sam-pıl-${index}`,
    example: `This is sample ${index}.`,
    tier: "A1",
  };
}

describe("native loading daily deck cache", () => {
  beforeEach(() => localStorage.clear());

  it("persists and reuses the selected locale-specific deck cards for one profile and day", () => {
    const cards = [createCard(1), createCard(2)];
    const selectDeckCards = vi.fn(() => cards);

    expect(getOrCreateNativeLoadingDailyDeckCards(identity, selectDeckCards)).toEqual(cards);
    expect(getOrCreateNativeLoadingDailyDeckCards(identity, () => [])).toEqual(cards);
    expect(selectDeckCards).toHaveBeenCalledOnce();
    expect(readNativeLoadingDailyDeckCards(identity)).toEqual(cards);
  });

  it("stores an empty deck distinctly from a cache miss", () => {
    const selectDeckCards = vi.fn(() => []);

    expect(getOrCreateNativeLoadingDailyDeckCards(identity, selectDeckCards)).toEqual([]);
    expect(readNativeLoadingDailyDeckCards(identity)).toEqual([]);
    expect(getOrCreateNativeLoadingDailyDeckCards(identity, () => [createCard(1)])).toEqual([]);
    expect(selectDeckCards).toHaveBeenCalledOnce();
  });

  it("isolates cache records by profile, learning language, UI locale and day", () => {
    saveNativeLoadingDailyDeckCards(identity, [createCard(1)]);
    saveNativeLoadingDailyDeckCards({ ...identity, profileId: "user-2" }, [createCard(2)]);
    saveNativeLoadingDailyDeckCards({ ...identity, learningLanguage: "de" }, [createCard(3)]);
    saveNativeLoadingDailyDeckCards({ ...identity, locale: "de" }, [createCard(4)]);

    expect(readNativeLoadingDailyDeckCards(identity)?.[0]?.sourceKey).toBe("en:word:sample-1");
    expect(readNativeLoadingDailyDeckCards({ ...identity, profileId: "user-2" })?.[0]?.sourceKey).toBe("en:word:sample-2");
    expect(readNativeLoadingDailyDeckCards({ ...identity, learningLanguage: "de" })?.[0]?.sourceKey).toBe("en:word:sample-3");
    expect(readNativeLoadingDailyDeckCards({ ...identity, locale: "de" })?.[0]?.sourceKey).toBe("en:word:sample-4");

    saveNativeLoadingDailyDeckCards({ ...identity, dateKey: "2026-11-06" }, [createCard(5)]);

    expect(readNativeLoadingDailyDeckCards(identity)).toBeNull();
    expect(readNativeLoadingDailyDeckCards({ ...identity, dateKey: "2026-11-06" })?.[0]?.sourceKey).toBe("en:word:sample-5");
  });

  it("caps a daily selection at eight cards and prunes older dates for the same cache scope", () => {
    saveNativeLoadingDailyDeckCards({ ...identity, dateKey: "2026-11-04" }, [createCard(0)]);

    const selected = getOrCreateNativeLoadingDailyDeckCards(identity, () =>
      Array.from({ length: 10 }, (_, index) => createCard(index + 1)),
    );

    expect(selected).toHaveLength(8);
    expect(readNativeLoadingDailyDeckCards(identity)).toHaveLength(8);
    expect(localStorage.length).toBe(1);
    expect(readNativeLoadingDailyDeckCards({ ...identity, dateKey: "2026-11-04" })).toBeNull();
  });

  it("rejects malformed persisted cards instead of passing corrupt data to the native bridge", () => {
    saveNativeLoadingDailyDeckCards(identity, [createCard(1)]);
    const key = localStorage.key(0);
    if (!key) throw new Error("Expected a persisted daily cache key");
    localStorage.setItem(key, JSON.stringify({ schemaVersion: 1, ...identity, cards: [{ term: "broken" }] }));

    expect(readNativeLoadingDailyDeckCards(identity)).toBeNull();
  });
});
