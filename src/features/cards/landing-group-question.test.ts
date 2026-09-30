import { describe, expect, it } from "vitest";
import { VOCABULARY_CARDS } from "@/data/cards";
import { buildLandingGroupQuestion, createLandingGroupQuestion } from "@/features/cards/landing-group-question";

describe("landing group question", () => {
  it("builds six language-consistent options with unique groups", () => {
    const source = VOCABULARY_CARDS.find((card) => card.language === "en" && card.englishKey === "apple");
    expect(source).toBeDefined();

    const question = buildLandingGroupQuestion(source!, "tr", () => 0.1);
    expect(question).not.toBeNull();
    expect(question!.options).toHaveLength(6);
    expect(new Set(question!.options.map((option) => option.group.id)).size).toBe(6);
    expect(question!.options.filter((option) => option.isCorrect)).toHaveLength(1);
    expect(question!.options.every((option) => option.card.language === "en")).toBe(true);
    expect(question!.options.find((option) => option.isCorrect)?.card.id).toBe(source!.id);
  });

  it("applies the forty percent appearance gate", () => {
    expect(createLandingGroupQuestion("en", "tr", () => 0.4)).toBeNull();
    expect(createLandingGroupQuestion("en", "tr", () => 0)).not.toBeNull();
  });
});
