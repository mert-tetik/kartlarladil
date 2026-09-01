import { describe, expect, it } from "vitest";
import { getAiPracticeCharacters } from "@/features/ai-practice/ai-practice-data";
import { getAiPracticeScenarioChatBackground } from "@/features/ai-practice/ai-practice-chat-backgrounds";
import {
  getAiPracticeScenario,
  getAiPracticeScenarios,
  getScenarioOpeningLine,
  getScenarioProfession,
  getScenarioSummary,
  getScenarioTitle,
} from "@/features/ai-practice/ai-practice-scenarios";

describe("AI practice situations", () => {
  it("keeps each situation attached to an existing character", () => {
    const characterIds = new Set(getAiPracticeCharacters().map((character) => character.id));

    expect(getAiPracticeScenarios()).toHaveLength(10);
    expect(new Set(getAiPracticeScenarios().map((scenario) => scenario.id)).size).toBe(10);
    expect(getAiPracticeScenarios().every((scenario) => characterIds.has(scenario.characterId))).toBe(true);
  });

  it("provides localized labels and a safe opening fallback", () => {
    const scenario = getAiPracticeScenario("restaurant-order");

    expect(scenario).toBeTruthy();
    expect(getScenarioTitle(scenario!, "tr")).toBe("Restoranda sipariş ver");
    expect(getScenarioSummary(scenario!, "en")).toContain("Choose a meal");
    expect(getScenarioOpeningLine(scenario!, "ja")).toBeTruthy();
  });

  it("has a dedicated readable photo background for every situation", () => {
    for (const scenario of getAiPracticeScenarios()) {
      const background = getAiPracticeScenarioChatBackground(scenario.id);

      expect(background.imageSrc).toBe(`/ai-chat-backgrounds/scenarios/${scenario.id}.jpg`);
      expect(background.overlay).toContain("linear-gradient");
    }
  });

  it("uses a dedicated profession portrait for every situation", () => {
    for (const scenario of getAiPracticeScenarios()) {
      expect(scenario.characterImageSrc).toBe(`/ai-characters/scenarios/${scenario.id}-v2.png`);
    }
  });

  it("uses localized profession labels instead of character names", () => {
    const directions = getAiPracticeScenario("asking-directions");
    const party = getAiPracticeScenario("party-introduction");

    expect(getScenarioProfession(directions!, "en")).toBe("Random citizen");
    expect(getScenarioProfession(directions!, "tr")).toBe("Rastgele vatandaş");
    expect(getScenarioProfession(party!, "en")).toBe("Random girl");
    expect(getScenarioProfession(party!, "tr")).toBe("Rastgele bir kız");

    for (const scenario of getAiPracticeScenarios()) {
      for (const locale of ["tr", "en", "de", "ru", "fr", "es", "it", "pt", "nl", "pl", "ar", "ja", "ko", "zh-CN"] as const) {
        expect(getScenarioProfession(scenario, locale)).toBeTruthy();
      }
    }
  });
});
