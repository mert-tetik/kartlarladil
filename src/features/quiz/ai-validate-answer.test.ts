import { describe, expect, it, vi } from "vitest";
import { aiValidateTextAnswer } from "@/features/quiz/ai-validate-answer";

describe("aiValidateTextAnswer", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("returns accepted: true when the API accepts the answer", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() =>
        Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ accepted: true }),
        }),
      ) as unknown as typeof fetch,
    );

    const result = await aiValidateTextAnswer({
      userAnswer: "hot",
      correctAnswers: ["warm"],
      targetLanguage: "en",
      sourceLanguage: "tr",
      promptContext: "warm -> ılık",
    });

    expect(result.accepted).toBe(true);
  });

  it("returns accepted: false when the API rejects the answer", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() =>
        Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ accepted: false }),
        }),
      ) as unknown as typeof fetch,
    );

    const result = await aiValidateTextAnswer({
      userAnswer: "cold",
      correctAnswers: ["warm"],
      targetLanguage: "en",
      sourceLanguage: "tr",
      promptContext: "warm -> ılık",
    });

    expect(result.accepted).toBe(false);
  });

  it("returns accepted: false when the fetch throws", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() => Promise.reject(new Error("network error"))) as unknown as typeof fetch,
    );

    const result = await aiValidateTextAnswer({
      userAnswer: "hot",
      correctAnswers: ["warm"],
      targetLanguage: "en",
      sourceLanguage: "tr",
      promptContext: "warm -> ılık",
    });

    expect(result.accepted).toBe(false);
  });

  it("returns accepted: false when the response body is malformed", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() =>
        Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ unexpected: true }),
        }),
      ) as unknown as typeof fetch,
    );

    const result = await aiValidateTextAnswer({
      userAnswer: "hot",
      correctAnswers: ["warm"],
      targetLanguage: "en",
      sourceLanguage: "tr",
      promptContext: "warm -> ılık",
    });

    expect(result.accepted).toBe(false);
  });
});
