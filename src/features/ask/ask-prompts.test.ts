import { buildAskInstructions } from "@/features/ask/ask-prompts";

describe("buildAskInstructions", () => {
  it("mentions the target language and UI language", () => {
    const instructions = buildAskInstructions({ language: "de", locale: "tr" });

    expect(instructions).toContain("Deutsch");
    expect(instructions).toContain("Türkçe");
    expect(instructions).toContain("FoxiesDeck");
  });

  it("asks the assistant to respond in the UI language and use target language examples", () => {
    const instructions = buildAskInstructions({ language: "fr", locale: "en" });

    expect(instructions).toContain("Respond in English");
    expect(instructions).toContain("examples, use Français");
  });

  it("forbids intentional spelling or grammar mistakes", () => {
    const instructions = buildAskInstructions({ language: "en", locale: "tr" });

    expect(instructions).toContain("Do not make spelling or grammar mistakes");
  });
});
