import { describe, expect, it } from "vitest";
import { takeRandomCardsInTierOrder } from "@/app/components/mobile-card-swipe-deck";
import type { Tier } from "@/types/domain";

describe("takeRandomCardsInTierOrder", () => {
  it("cycles A1, A2, B1, B2, C1 across consecutive batches", () => {
    const candidates = (["A1", "A2", "B1", "B2", "C1"] as Tier[]).flatMap((tier) => [
      { id: `${tier}-first`, tier },
      { id: `${tier}-second`, tier },
    ]);

    const first = takeRandomCardsInTierOrder(candidates, 3, 0, () => 0);
    const second = takeRandomCardsInTierOrder(
      candidates.filter((candidate) => !first.cards.some((card) => card.id === candidate.id)),
      7,
      first.nextTierIndex,
      () => 0.999,
    );

    expect([...first.cards, ...second.cards].map((card) => card.tier)).toEqual([
      "A1", "A2", "B1", "B2", "C1", "A1", "A2", "B1", "B2", "C1",
    ]);
    expect(new Set([...first.cards, ...second.cards].map((card) => card.id)).size).toBe(10);
  });

  it("skips tiers with no eligible cards and still randomizes within an available tier", () => {
    const candidates = [
      { id: "a1-first", tier: "A1" as const },
      { id: "a1-second", tier: "A1" as const },
      { id: "b1-only", tier: "B1" as const },
    ];

    const result = takeRandomCardsInTierOrder(candidates, 3, 0, () => 0.999);

    expect(result.cards.map((card) => card.id)).toEqual(["a1-second", "b1-only", "a1-first"]);
    expect(result.nextTierIndex).toBe(1);
  });

  it("repeats a preferred tier twice in the deterministic schedule", () => {
    const candidates = (["A1", "A2", "B1", "B2", "C1"] as Tier[]).flatMap((tier) => [
      { id: `${tier}-first`, tier },
      { id: `${tier}-second`, tier },
      { id: `${tier}-third`, tier },
    ]);

    const result = takeRandomCardsInTierOrder(candidates, 6, 0, () => 0, {
      A1: 1,
      A2: 2,
      B1: 1,
      B2: 1,
      C1: 1,
    });

    expect(result.cards.map((card) => card.tier)).toEqual(["A1", "A2", "A2", "B1", "B2", "C1"]);
  });

  it("supports two simultaneously dominant tiers with at most three appearances each", () => {
    const candidates = (["A1", "A2", "B1", "B2", "C1"] as Tier[]).flatMap((tier) => [
      { id: `${tier}-first`, tier },
      { id: `${tier}-second`, tier },
      { id: `${tier}-third`, tier },
    ]);

    const result = takeRandomCardsInTierOrder(candidates, 6, 0, () => 0, {
      A1: 3,
      A2: 3,
      B1: 1,
      B2: 1,
      C1: 1,
    });

    expect(result.cards.map((card) => card.tier)).toEqual(["A1", "A1", "A1", "A2", "A2", "A2"]);
    expect(new Set(result.cards.map((card) => card.id)).size).toBe(6);
  });

  it("skips repeated schedule slots when a preferred tier runs out", () => {
    const candidates = [
      { id: "a1-only", tier: "A1" as const },
      { id: "a2-only", tier: "A2" as const },
      { id: "b1-only", tier: "B1" as const },
    ];

    const result = takeRandomCardsInTierOrder(candidates, 3, 0, () => 0, {
      A1: 1,
      A2: 3,
      B1: 1,
      B2: 1,
      C1: 1,
    });

    expect(result.cards.map((card) => card.tier)).toEqual(["A1", "A2", "B1"]);
    expect(new Set(result.cards.map((card) => card.id)).size).toBe(3);
  });
});
