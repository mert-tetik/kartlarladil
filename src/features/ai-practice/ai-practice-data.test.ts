import { LANGUAGE_CODES, LOCALE_CODES } from "@/data/languages";
import { getAiPracticeCharacters } from "@/features/ai-practice/ai-practice-data";
import { buildAiPracticeInstructions } from "@/features/ai-practice/ai-practice-prompts";

describe("AI practice characters", () => {
  it("contains exactly 10 characters with clean image paths", () => {
    const characters = getAiPracticeCharacters();

    expect(characters).toHaveLength(10);

    for (const character of characters) {
      expect(character.imageSrc).toMatch(/^\/ai-characters\/[a-z0-9-]+\.png$/);
      expect(character.imageSrc).not.toContain("ChatGPT");
      expect(character.promptProfile.trim().length).toBeGreaterThan(80);
      expect(character.conversationStyle.length).toBeGreaterThanOrEqual(3);
    }
  });

  it("has a name and localized summary for every supported language", () => {
    for (const character of getAiPracticeCharacters()) {
      for (const language of LANGUAGE_CODES) {
        expect(character.namesByLanguage[language]).toBeTruthy();
      }

      for (const locale of LOCALE_CODES) {
        expect(character.summaryByLocale[locale]).toBeTruthy();
      }
    }
  });

  it("builds instructions with the selected target language and character profile", () => {
    const character = getAiPracticeCharacters()[0];
    const instructions = buildAiPracticeInstructions({ character, language: "de" });

    expect(instructions).toContain("Deutsch");
    expect(instructions).toContain(character.promptProfile);
    expect(instructions).toContain("You must speak only in the target language");
    expect(instructions).toContain("Sound as realistic and human as possible");
    expect(instructions).toContain("do not answer like an expert");
    expect(instructions).toContain("Never demand full-sentence answers");
    expect(instructions).toContain("Do not use em dashes");
  });

  it("includes tier guidance when a proficiency level is provided", () => {
    const character = getAiPracticeCharacters()[0];
    const instructions = buildAiPracticeInstructions({ character, language: "en", tier: "B1" });

    expect(instructions).toContain("Learner proficiency level: B1");
    expect(instructions).toContain("connected sentences");
  });

  it("adds Gen Z behavior rules for young characters", () => {
    const youngCharacter = getAiPracticeCharacters().find((character) => character.id === "sleepy-student");

    expect(youngCharacter).toBeTruthy();

    const instructions = buildAiPracticeInstructions({ character: youngCharacter!, language: "en" });

    expect(instructions).toContain("Use target-language Gen Z slang");
    expect(instructions).toContain("do not make spelling or grammar mistakes");
    expect(instructions).toContain("Do not end messages with sentence-final punctuation");
  });

  it("does not include complete-sentence coaching in character styles", () => {
    for (const character of getAiPracticeCharacters()) {
      expect(character.conversationStyle.join(" ")).not.toMatch(/complete sentences|full sentence/i);
    }
  });
});
