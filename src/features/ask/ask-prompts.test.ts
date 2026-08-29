import { buildAskInstructions } from "@/features/ask/ask-prompts";

describe("buildAskInstructions", () => {
  it("asks GPT to infer both conversation languages", () => {
    const instructions = buildAskInstructions({
      locale: "tr",
      previousState: {
        nativeLanguageCode: "tr",
        learningLanguageCode: "de",
      },
      contextLanguage: "de",
    });

    expect(instructions).toContain("nativeLanguageCode");
    expect(instructions).toContain("learningLanguageCode");
    expect(instructions).toContain("Deutsch");
    expect(instructions).toContain("Previously inferred native language");
    expect(instructions).toContain("FoxiesDeck");
  });

  it("uses the inferred native language for explanations and learning language for examples", () => {
    const instructions = buildAskInstructions({ locale: "en" });

    expect(instructions).toContain("answer in the inferred native language");
    expect(instructions).toContain("inferred learning language only for examples");
    expect(instructions).toContain("There is no preselected learning language");
  });

  it("keeps explanations in the native language and examples in the learning language", () => {
    const instructions = buildAskInstructions({ locale: "tr" });

    expect(instructions).toContain("nativeLanguageCode is the language for explanations");
    expect(instructions).toContain("compensate ile cümle örneği");
    expect(instructions).toContain("each requested example sentence must be entirely in learningLanguageCode");
  });

  it("does not treat an automatic card prompt as proof of the native language", () => {
    const instructions = buildAskInstructions({ locale: "tr", contextLanguage: "en" });

    expect(instructions).toContain("app-generated request to explain a card");
    expect(instructions).toContain("Keep the native language unknown");
  });

  it("forbids intentional spelling or grammar mistakes", () => {
    const instructions = buildAskInstructions({ locale: "tr" });

    expect(instructions).toContain("Do not make spelling or grammar mistakes");
  });
});
