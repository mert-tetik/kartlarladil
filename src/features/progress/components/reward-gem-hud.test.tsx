import { act, renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { useGemRewardDisplay } from "./reward-gem-hud";

describe("useGemRewardDisplay", () => {
  it("adds the exact arrived amount and advances the pulse for every gem arrival", () => {
    const { result } = renderHook(() => useGemRewardDisplay());
    const finalBalances = { blue: 8, green: 5, purple: 2 };
    const rewards = [{ type: "blue" as const, amount: 4 }];

    act(() => result.current.prepare(finalBalances, rewards));
    expect(result.current.balances).toEqual({ blue: 4, green: 5, purple: 2 });

    act(() => result.current.handleGemArrive("blue", 2));
    expect(result.current.balances?.blue).toBe(6);
    expect(result.current.pulse).toEqual({ type: "blue", key: 1 });

    act(() => result.current.handleGemArrive("blue", 2));
    expect(result.current.balances?.blue).toBe(8);
    expect(result.current.pulse).toEqual({ type: "blue", key: 2 });
  });
});
