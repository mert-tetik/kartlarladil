import { describe, expect, it } from "vitest";
import type { GemBalances } from "@/features/gems/gem-types";
import { getMissionGemDisplayBalances, getMissionPointsDisplayTotal } from "./mission-reward-display";

describe("mission reward display totals", () => {
  it("shows each arrived point particle while its claim is still pending", () => {
    const displayPoints = getMissionPointsDisplayTotal(
      108,
      [
        { missionId: "pending", kind: "points", amount: 10 },
        { missionId: "settled", kind: "points", amount: 8, claimSettled: true },
      ],
      { pending: 4, settled: 3 },
    );

    expect(displayPoints).toBe(107);
  });

  it("increments gems during pending claims and subtracts only settled rewards still in flight", () => {
    const profileBalances: GemBalances = { blue: 7, green: 9, purple: 3 };
    const displayBalances = getMissionGemDisplayBalances(
      profileBalances,
      [
        { missionId: "pending", kind: "gems", gemType: "blue", amount: 4 },
        {
          missionId: "settled",
          kind: "gems",
          gemType: "green",
          amount: 3,
          balances: { blue: 7, green: 9, purple: 3 },
          claimSettled: true,
        },
      ],
      { pending: 1, settled: 2 },
    );

    expect(displayBalances).toEqual({ blue: 8, green: 8, purple: 3 });
  });
});
