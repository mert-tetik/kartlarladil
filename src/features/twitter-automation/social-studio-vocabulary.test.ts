import { formatSocialStudioVocabularyUsage, normalizeSocialStudioVocabularyTerm } from "@/features/twitter-automation/social-studio-vocabulary";

describe("social studio vocabulary history", () => {
  it("normalizes a term before it is compared with history", () => {
    expect(normalizeSocialStudioVocabularyTerm("  Café   NOIR ")).toBe("café noir");
  });

  it("keeps usage dates attached to the corresponding term for the planner", () => {
    expect(formatSocialStudioVocabularyUsage([
      { term: "look", usedAt: "2026-08-01T10:00:00.000Z" },
      { term: "observe", usedAt: "2026-07-01T10:00:00.000Z" },
    ])).toEqual([
      { term: "look", lastUsedAt: "2026-08-01T10:00:00.000Z" },
      { term: "observe", lastUsedAt: "2026-07-01T10:00:00.000Z" },
    ]);
  });
});
