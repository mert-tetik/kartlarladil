import { describe, expect, it } from "vitest";
import { CHEST_TIERS } from "@/features/quiz/chest-rewards";
import type { GemBalances } from "@/features/gems/gem-types";
import {
  completeMissionRewardAnimation,
  enqueueMissionRewardAnimation,
  getActiveMissionRewardAnimations,
  removeMissionRewardAnimation,
  settleMissionRewardAnimation,
} from "./mission-reward-queue";

const points = (missionId: string) => ({ missionId, kind: "points" as const, amount: 50 });
const gems = (missionId: string) => ({ missionId, kind: "gems" as const, gemType: "green" as const, amount: 4 });

describe("mission reward animation queue", () => {
  it("starts every points scatter immediately instead of waiting for the previous flight", () => {
    let queue = enqueueMissionRewardAnimation([], points("first"));
    queue = enqueueMissionRewardAnimation(queue, points("second"));
    queue = enqueueMissionRewardAnimation(queue, points("third"));

    expect(getActiveMissionRewardAnimations(queue).map((mode) => mode.missionId)).toEqual([
      "first",
      "second",
      "third",
    ]);
  });

  it("starts point and gem scatters concurrently, including while a claim is pending", () => {
    let queue = enqueueMissionRewardAnimation([], points("points-a"));
    queue = enqueueMissionRewardAnimation(queue, gems("gems-a"));
    queue = enqueueMissionRewardAnimation(queue, points("points-b"));
    queue = enqueueMissionRewardAnimation(queue, gems("gems-b"));

    expect(getActiveMissionRewardAnimations(queue).map((mode) => mode.missionId)).toEqual([
      "points-a",
      "gems-a",
      "points-b",
      "gems-b",
    ]);
  });

  it("keeps direct gem balance metadata with its animation while it runs", () => {
    const balances: GemBalances = { blue: 3, green: 8, purple: 1 };
    let queue = enqueueMissionRewardAnimation([], gems("gems-a"));
    queue = settleMissionRewardAnimation(queue, "gems-a", undefined, balances);

    expect(queue[0]?.claimSettled).toBe(true);
    expect(queue[0]?.mode).toMatchObject({ kind: "gems", balances });
    expect(getActiveMissionRewardAnimations(queue)).toHaveLength(1);
  });

  it("keeps chest videos sequential while allowing point scatters to run beside them", () => {
    let queue = enqueueMissionRewardAnimation([], { missionId: "chest-one", kind: "chest", tier: CHEST_TIERS[0] });
    queue = enqueueMissionRewardAnimation(queue, { missionId: "chest-two", kind: "chest", tier: CHEST_TIERS[1] });
    queue = enqueueMissionRewardAnimation(queue, points("points-one"));

    expect(getActiveMissionRewardAnimations(queue).map((mode) => mode.missionId)).toEqual([
      "points-one",
      "chest-one",
    ]);
    queue = completeMissionRewardAnimation(queue, "chest-one");
    expect(getActiveMissionRewardAnimations(queue).map((mode) => mode.missionId)).toEqual([
      "points-one",
      "chest-two",
    ]);
  });

  it("keeps a finished animation until its claim resolves, without blocking later animations", () => {
    let queue = enqueueMissionRewardAnimation([], points("slow-claim"));
    queue = enqueueMissionRewardAnimation(queue, points("next-claim"));
    queue = completeMissionRewardAnimation(queue, "slow-claim");

    expect(getActiveMissionRewardAnimations(queue).map((mode) => mode.missionId)).toEqual(["next-claim"]);
    queue = settleMissionRewardAnimation(queue, "slow-claim");
    expect(queue.map((entry) => entry.mode.missionId)).toEqual(["next-claim"]);
  });

  it("removes a failed claim and lets the next stacked animation continue", () => {
    let queue = enqueueMissionRewardAnimation([], points("failed"));
    queue = enqueueMissionRewardAnimation(queue, points("next"));
    queue = removeMissionRewardAnimation(queue, "failed");

    expect(getActiveMissionRewardAnimations(queue).map((mode) => mode.missionId)).toEqual(["next"]);
  });

  it("does not enqueue a duplicate animation for the same mission", () => {
    const queue = enqueueMissionRewardAnimation([], points("same"));

    expect(enqueueMissionRewardAnimation(queue, points("same"))).toHaveLength(1);
  });
});
