import { describe, expect, it } from "vitest";
import { aiGenerationBoundaryIndex, isAiAutomationGeneration, prioritizeAutomationGenerations } from "./automation-generation-priority";

describe("automation generation priority", () => {
  it("keeps local generations first and defers every AI-backed generation", () => {
    const outputs = [
      { generator: "ai-mini-quiz", id: "ai-image" },
      { generator: "self-mini-quiz", id: "self-image" },
      { generator: "fun-post", id: "ai-text" },
      { generator: "music-ai-word-of-the-day", id: "ai-music-video" },
      { generator: "confused-words-video", id: "self-video" },
    ];

    expect(prioritizeAutomationGenerations(outputs).map((output) => output.id)).toEqual([
      "self-image",
      "self-video",
      "ai-image",
      "ai-text",
      "ai-music-video",
    ]);
    expect(aiGenerationBoundaryIndex(outputs)).toBe(2);
  });

  it("recognizes direct, text, music-image, and unresolved random AI work", () => {
    expect(isAiAutomationGeneration("ai-word-of-the-day-video")).toBe(true);
    expect(isAiAutomationGeneration("fun-post")).toBe(true);
    expect(isAiAutomationGeneration("music-ai-mini-quiz")).toBe(true);
    expect(isAiAutomationGeneration("random-content")).toBe(true);
    expect(isAiAutomationGeneration("self-example-sentences")).toBe(false);
    expect(isAiAutomationGeneration("music-self-mini-quiz")).toBe(false);
  });
});
