import { describe, expect, it } from "vitest";
import { VOCABULARY_CARDS } from "@/data/cards";
import {
  buildGroupQuestion,
  shouldUseGroupQuestion,
} from "@/features/quiz/group-question";

describe("group quiz question", () => {
  it("builds six language-consistent visual group options", () => {
    const source = VOCABULARY_CARDS.find(
      (card) => card.language === "en" && card.englishKey === "apple",
    );
    expect(source).toBeDefined();

    const question = buildGroupQuestion(source!, () => 0.1);
    expect(question).not.toBeNull();
    expect(question!.options).toHaveLength(6);
    expect(new Set(question!.options.map((option) => option.group.id)).size).toBe(6);
    expect(question!.options.filter((option) => option.isCorrect)).toHaveLength(1);
    expect(question!.options.every((option) => option.card.language === "en")).toBe(true);
    expect(question!.options.find((option) => option.isCorrect)?.card.id).toBe(source!.id);
  });

  it("uses the normal-question probability gate", () => {
    expect(shouldUseGroupQuestion(() => 0.29)).toBe(true);
    expect(shouldUseGroupQuestion(() => 0.3)).toBe(false);
  });
});
