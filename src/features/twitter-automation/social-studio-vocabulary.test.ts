import { normalizeSocialStudioVocabularyTerm } from "@/features/twitter-automation/social-studio-vocabulary";

describe("social studio vocabulary", () => {
  it("normalizes a term before it is compared", () => {
    expect(normalizeSocialStudioVocabularyTerm("  Café   NOIR ")).toBe("café noir");
  });
});
