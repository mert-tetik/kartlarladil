import { describe, expect, it } from "vitest";
import { getQuizPromptTerm } from "./quiz-prompt-term";

describe("getQuizPromptTerm", () => {
  it("shows only the first comma-separated native-language meaning", () => {
    expect(getQuizPromptTerm("apple, fruit, tree fruit")).toBe("apple");
    expect(getQuizPromptTerm("  apple  , fruit")).toBe("apple");
  });

  it("keeps a full term when there is no usable first meaning", () => {
    expect(getQuizPromptTerm("apple")).toBe("apple");
    expect(getQuizPromptTerm(", fruit")).toBe(", fruit");
  });
});
