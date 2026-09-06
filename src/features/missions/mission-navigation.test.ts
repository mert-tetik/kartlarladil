import { describe, expect, it } from "vitest";
import { TIERS } from "@/data/tiers";
import type { MissionDefinition } from "./mission-types";
import {
  getMissionNavigationHref,
  parseLandingMissionAction,
  parseMissionGame,
  resolveMissionNavigation,
  selectRandomPracticeTier,
} from "./mission-navigation";

function mission(type: MissionDefinition["type"], options: Partial<MissionDefinition> = {}): MissionDefinition {
  return {
    id: "test-mission",
    index: 0,
    type,
    requirement: 1,
    reward: { kind: "points", amount: 100 },
    ...options,
  };
}

describe("mission navigation", () => {
  it("resolves card and learning missions to mobile landing actions with desktop fallbacks", () => {
    const drawTarget = resolveMissionNavigation(mission("add_cards"), "en", 0.5);
    const learningTarget = resolveMissionNavigation(mission("learn_cards"), "de", 0.5);

    expect(drawTarget).toMatchObject({ kind: "landing-action", action: "draw-cards", language: "en" });
    expect(learningTarget).toMatchObject({ kind: "landing-action", action: "start-learning", language: "de" });
    expect(getMissionNavigationHref(drawTarget!, true)).toBe("/?mission-action=draw-cards&language=en");
    expect(getMissionNavigationHref(drawTarget!, false)).toBe("/card-draw");
    expect(getMissionNavigationHref(learningTarget!, false)).toBe("/learn?mode=active&language=de");
  });

  it("opens the requested character chat at a randomly selected tier", () => {
    const target = resolveMissionNavigation(
      mission("ai_practice", { characterId: "friendly-worker" }),
      "en",
      0.99,
    );

    expect(target).toEqual({
      kind: "route",
      href: "/ai-practice/en/friendly-worker?tier=C1",
    });
    expect(TIERS).toContain(selectRandomPracticeTier(0));
    expect(selectRandomPracticeTier(0)).toBe("A1");
    expect(selectRandomPracticeTier(0.999999)).toBe("C1");
  });

  it("opens the requested game through the one-shot auto-start intent", () => {
    const target = resolveMissionNavigation(mission("game_level", { game: "wordMatch" }), "en");

    expect(target).toEqual({
      kind: "route",
      href: "/games?mission-game=wordMatch&mission-auto-start=1",
    });
    expect(parseMissionGame("memory")).toBe("memory");
    expect(parseMissionGame("unknown")).toBeNull();
  });

  it("rejects unknown landing actions and does not create character routes without a character", () => {
    expect(parseLandingMissionAction("unknown")).toBeNull();
    expect(resolveMissionNavigation(mission("ai_practice"), "en")).toBeNull();
  });
});
