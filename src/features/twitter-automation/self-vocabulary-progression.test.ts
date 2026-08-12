import { describe, expect, it } from "vitest";
import {
  isSelfVocabularyProgressionContent,
  normalizeSelfVocabularyProgressionTerm,
} from "@/features/twitter-automation/self-vocabulary-progression";

const progression = {
  beginnerTerm: "happy",
  intermediateTerm: "delighted",
  advancedTerm: "elated",
  beginnerTier: "A1",
  intermediateTier: "B2",
  advancedTier: "C1",
  beginnerExplanation: "Mutlu, genel bir iyi hissetme durumunu anlatır.",
  intermediateExplanation: "Delighted, belirgin bir sevinç ve memnuniyet anlatır.",
  advancedExplanation: "Elated, çok güçlü ve coşkulu bir mutluluk için kullanılır.",
};

describe("self vocabulary progression", () => {
  it("normalizes generated terms before duplicate checks", () => {
    expect(normalizeSelfVocabularyProgressionTerm("  ELATED  ")).toBe("elated");
  });

  it("requires a complete A1, B2, C1 progression with native explanations", () => {
    expect(isSelfVocabularyProgressionContent(progression)).toBe(true);
    expect(isSelfVocabularyProgressionContent({ ...progression, intermediateTier: "B1" })).toBe(false);
    expect(isSelfVocabularyProgressionContent({ ...progression, advancedExplanation: "" })).toBe(false);
  });
});
