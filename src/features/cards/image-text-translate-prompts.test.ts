import { describe, expect, it } from "vitest";
import {
  buildImageTextTranslateInstructions,
  buildImageTextTranslateTextInput,
} from "@/features/cards/image-text-translate-prompts";

describe("image-text translate prompts", () => {
  it("contains the source-language, ordering, document, and question rules", () => {
    const instructions = buildImageTextTranslateInstructions({ locale: "tr", targetLanguage: "en" });

    expect(instructions).toContain("only accepted source language is İngilizce");
    expect(instructions).toContain("detectedText is NEVER translated");
    expect(instructions).toContain("multiple independent texts/documents");
    expect(instructions).toContain("questionAnswers array is mandatory");
    expect(instructions).toContain("translatedText");
  });

  it("labels text fragments without sending image content", () => {
    const input = buildImageTextTranslateTextInput("First line\nSecond line", "en");

    expect(input).toContain('<source-fragment id="fragment-1">First line</source-fragment>');
    expect(input).toContain('<source-fragment id="fragment-2">Second line</source-fragment>');
    expect(input).not.toContain("input_image");
  });
});
