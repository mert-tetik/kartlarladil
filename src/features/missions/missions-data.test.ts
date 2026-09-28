import { describe, expect, it } from "vitest";
import { AI_PRACTICE_CHARACTER_IDS } from "@/features/ai-practice/ai-practice-data";
import { CHEST_MISSION_REWARD_TIERS, MISSIONS } from "./missions-data";
import { GEM_POINTS } from "@/features/gems/gem-types";

describe("mission definitions", () => {
  it("contains 80 missions while preserving the original mission id sequence", () => {
    expect(MISSIONS).toHaveLength(80);
    expect(new Set(MISSIONS.map((mission) => mission.id)).size).toBe(80);

    for (let index = 0; index < 50; index += 1) {
      const cycle = index % 4;
      const tier = Math.floor(index / 4);
      const expectedId = cycle === 0
        ? `add_cards_${index + 1}`
        : cycle === 1
          ? `learn_cards_${index + 1}`
          : cycle === 2
            ? `game_level_${["memory", "wordChallenge", "wordMatch"][tier % 3]}_${index + 1}`
            : `ai_practice_${AI_PRACTICE_CHARACTER_IDS[tier % AI_PRACTICE_CHARACTER_IDS.length]}_${index + 1}`;

      expect(MISSIONS[index].id).toBe(expectedId);
    }
  });

  it("keeps all four mission types balanced", () => {
    const counts = MISSIONS.reduce<Record<string, number>>((result, mission) => {
      result[mission.type] = (result[mission.type] ?? 0) + 1;
      return result;
    }, {});

    expect(counts).toEqual({
      add_cards: 20,
      learn_cards: 20,
      game_level: 20,
      ai_practice: 20,
    });
  });

  it("uses a progressive chest reward ladder with scarce ruby rewards", () => {
    const chestTiers = MISSIONS
      .filter((mission) => mission.reward.kind === "chest")
      .map((mission) => mission.reward.kind === "chest" ? mission.reward.tier : null);

    expect(chestTiers).toEqual(CHEST_MISSION_REWARD_TIERS);
    expect(chestTiers).toHaveLength(20);
    expect(chestTiers.filter((tier) => tier === "ruby")).toHaveLength(2);
    expect(chestTiers.slice(0, 17)).not.toContain("ruby");
    expect(new Set(chestTiers)).toEqual(new Set(["wood", "iron", "gold", "diamond", "emerald", "ruby"]));
  });

  it("converts exactly half of the point missions into point-equivalent gem rewards", () => {
    const pointMissions = MISSIONS.filter((mission) => mission.type !== "add_cards");
    const gemMissions = MISSIONS.filter((mission) => mission.reward.kind === "gems");
    const remainingPointMissions = MISSIONS.filter((mission) => mission.reward.kind === "points");

    expect(pointMissions).toHaveLength(60);
    expect(gemMissions).toHaveLength(30);
    expect(remainingPointMissions).toHaveLength(30);
    expect(gemMissions.every((mission) => mission.reward.kind === "gems")).toBe(true);
    expect(gemMissions.every((mission) => mission.type === "learn_cards" || mission.type === "ai_practice")).toBe(true);

    for (const mission of gemMissions) {
      if (mission.reward.kind !== "gems") continue;
      expect(mission.reward.amount).toBe(Math.max(
        1,
        Math.ceil(mission.reward.pointEquivalent / (GEM_POINTS[mission.reward.gemType] * 2)),
      ));
      expect(mission.reward.amount).toBeGreaterThan(0);
    }
  });

  it("gives harder missions a higher gem rarity mix while retaining blue and green at the hardest tier", () => {
    const gemRewards = MISSIONS.flatMap((mission) => mission.reward.kind === "gems"
      ? [{ tier: Math.floor(mission.index / 4), reward: mission.reward }]
      : []);
    const difficultyBands = Array.from({ length: 5 }, (_, band) =>
      gemRewards.filter((entry) => Math.floor(entry.tier / 4) === band),
    );
    const hardestTier = gemRewards.filter((entry) => entry.tier === 19);

    expect(difficultyBands.map((band) => band.filter((entry) => entry.reward.gemType === "purple").length))
      .toEqual([0, 0, 2, 3, 4]);
    expect(difficultyBands[0]?.every((entry) => entry.reward.gemType === "blue")).toBe(true);
    expect(hardestTier.map((entry) => entry.reward.gemType)).toContain("green");
    expect(hardestTier.map((entry) => entry.reward.gemType)).toContain("purple");
    expect(difficultyBands[4]?.map((entry) => entry.reward.gemType)).toContain("blue");

    const sameValueBlue = Math.ceil(575 / GEM_POINTS.blue);
    const sameValueGreen = Math.ceil(575 / GEM_POINTS.green);
    const sameValuePurple = Math.ceil(575 / GEM_POINTS.purple);
    expect(sameValueBlue).toBeGreaterThan(sameValueGreen);
    expect(sameValueGreen).toBeGreaterThan(sameValuePurple);
  });
});
