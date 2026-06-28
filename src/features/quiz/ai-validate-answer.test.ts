import { aiValidateTextAnswer } from "@/features/quiz/ai-validate-answer";
import { vi } from "vitest";

describe("aiValidateTextAnswer", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("returns accepted: true when the API responds with 't'", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() =>
        Promise.resolve({
          json: () => Promise.resolve({ accepted: true }),
        }),
      ) as unknown as typeof fetch,
    );

    const result = await aiValidateTextAnswer({
      userAnswer: "apple",
      correctAnswers: ["apple"],
      targetLanguage: "en",
      sourceLanguage: "tr",
      promptContext: "elma",
    });

    expect(result.accepted).toBe(true);
  });

  it("returns accepted: false when the API responds with 'y'", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() =>
        Promise.resolve({
          json: () => Promise.resolve({ accepted: false }),
        }),
      ) as unknown as typeof fetch,
    );

    const result = await aiValidateTextAnswer({
      userAnswer: "banana",
      correctAnswers: ["apple"],
      targetLanguage: "en",
      sourceLanguage: "tr",
      promptContext: "elma",
    });

    expect(result.accepted).toBe(false);
  });

  it("returns accepted: false when the fetch throws", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() => Promise.reject(new Error("network error"))) as unknown as typeof fetch,
    );

    const result = await aiValidateTextAnswer({
      userAnswer: "apple",
      correctAnswers: ["apple"],
      targetLanguage: "en",
      sourceLanguage: "tr",
      promptContext: "elma",
    });

    expect(result.accepted).toBe(false);
  });

  it("returns accepted: false when the response body is malformed", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() =>
        Promise.resolve({
          json: () => Promise.resolve({ unexpected: true }),
        }),
      ) as unknown as typeof fetch,
    );

    const result = await aiValidateTextAnswer({
      userAnswer: "apple",
      correctAnswers: ["apple"],
      targetLanguage: "en",
      sourceLanguage: "tr",
      promptContext: "elma",
    });

    expect(result.accepted).toBe(false);
  });
});
