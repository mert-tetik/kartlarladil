import { describe, expect, it } from "vitest";
import {
  buildImageTextTranslateInstructions,
  buildImageTextTranslateTextInput,
  buildImageTextWordTranslateInstructions,
  buildImageTextWordTranslateInput,
} from "@/features/cards/image-text-translate-prompts";

describe("image-text translation prompts", () => {
  it("describes source reconstruction, sentence pairing, and answered questions", () => {
    const instructions = buildImageTextTranslateInstructions({ locale: "tr", targetLanguage: "en" });

    expect(instructions).toContain("most logical chronological order");
    expect(instructions).toContain("Split the result into ordered sentence units");
    expect(instructions).toContain("Every array item must contain exactly one complete sentence");
    expect(instructions).toContain("separators");
    expect(instructions).toContain('"text", "paragraph", and "question"');
    expect(instructions).toContain("Answer each answerable question");
    expect(instructions).toContain("one sentences array");
    expect(instructions).not.toContain("wordTranslations");
    expect(instructions).not.toContain("wordLinks");
    expect(instructions).toContain("Do not include markdown fences, explanations, chronology notes, vocabulary lists");
  });

  it("labels text fragments without sending image content", () => {
    const input = buildImageTextTranslateTextInput("First line\nSecond line", "en");

    expect(input).toContain('<source-fragment id="fragment-1">First line</source-fragment>');
    expect(input).toContain('<source-fragment id="fragment-2">Second line</source-fragment>');
    expect(input).not.toContain("input_image");
  });

  it("preserves questions without answers when the option is disabled", () => {
    const instructions = buildImageTextTranslateInstructions({ locale: "tr", targetLanguage: "en", answerQuestions: false });
    const input = buildImageTextTranslateTextInput("What is this?", "en", false);

    expect(instructions).toContain("do not answer, solve, or add answer lines");
    expect(instructions).not.toContain("Answer each answerable question");
    expect(input).toContain("preserve source-language questions without answering them");
  });

  it("keeps word translation scoped to the clicked token and its document context", () => {
    const instructions = buildImageTextWordTranslateInstructions({ locale: "tr", sourceLanguage: "en", clickedLanguage: "en" });
    const input = buildImageTextWordTranslateInput({
      word: "chronological",
      clickedLanguage: "en",
      sourceText: "The events are chronological.",
      translatedText: "Olaylar kronolojiktir.",
    });

    expect(instructions).toContain("Translate only the clicked token");
    expect(instructions).toContain("Return exactly one JSON object with a translation string field");
    expect(instructions).not.toContain("meaning");
    expect(input).toContain("<clicked-token language=\"en\">chronological</clicked-token>");
    expect(input).toContain("The events are chronological.");
    expect(input).toContain("Olaylar kronolojiktir.");
  });
});
