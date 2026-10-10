import { describe, expect, it } from "vitest";
import {
  buildImageTextTranslateInstructions,
  buildImageTextTranslateTextInput,
  buildImageTextExtractImageInput,
  buildImageTextExtractInstructions,
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
    expect(instructions).toContain("Only numbered comprehension questions are answerable");
    expect(instructions).toContain("Dialogue questions, rhetorical questions");
    expect(instructions).toContain("exactly two consecutive items");
    expect(instructions).toContain("must become separate source items");
    expect(instructions).toContain("Split quoted multi-sentence text the same way");
    expect(instructions).toContain("FINAL VALIDATION BEFORE JSON");
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

  it("preserves blank lines as paragraph boundaries for the text pipeline", () => {
    const input = buildImageTextTranslateTextInput("First paragraph.\n\nSecond paragraph.", "en");

    expect(input).toContain('<source-break id="break-2" />');
    expect(input).toContain("source-break marker represents a blank line");
    expect(input).toContain("answer only numbered source-language questions");
  });

  it("keeps image extraction separate from translation", () => {
    const instructions = buildImageTextExtractInstructions({ locale: "tr", targetLanguage: "en" });
    const input = buildImageTextExtractImageInput("en");

    expect(instructions).toContain("source-document text extraction engine");
    expect(instructions).toContain("Do not translate, answer questions, summarize");
    expect(input).toContain("Extract and reconstruct only the visible source-language text");
    expect(input).not.toContain("answer source-language questions");
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
