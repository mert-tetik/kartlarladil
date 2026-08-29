import { describe, expect, it } from "vitest";
import { AI_PRACTICE_CHARACTER_IDS } from "@/features/ai-practice/ai-practice-data";
import { CHEST_MISSION_REWARD_TIERS, MISSIONS } from "./missions-data";

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
});
