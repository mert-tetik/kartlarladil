import { renderHook, act } from "@testing-library/react";
import { useAiQuizValidationLimit } from "@/features/quiz/use-ai-quiz-validation-limit";

describe("useAiQuizValidationLimit", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("allows usage and tracks remaining for free users", () => {
    const { result } = renderHook(() => useAiQuizValidationLimit("free"));

    expect(result.current.remaining).toBe(15);
    expect(result.current.canUse()).toBe(true);

    act(() => {
      result.current.consume();
    });

    expect(result.current.remaining).toBe(14);
  });

  it("blocks usage once the free daily limit is exhausted", () => {
    window.localStorage.setItem(
      "foxiesdeck:ai-quiz-validation:daily",
      JSON.stringify({ date: new Date().toISOString().slice(0, 10), count: 15 }),
    );

    const { result } = renderHook(() => useAiQuizValidationLimit("free"));

    expect(result.current.remaining).toBe(0);
    expect(result.current.canUse()).toBe(false);
  });

  it("resets the counter for a new day", () => {
    window.localStorage.setItem(
      "foxiesdeck:ai-quiz-validation:daily",
      JSON.stringify({ date: "2020-01-01", count: 15 }),
    );

    const { result } = renderHook(() => useAiQuizValidationLimit("free"));

    expect(result.current.remaining).toBe(15);
    expect(result.current.canUse()).toBe(true);
  });

  it("is unlimited for paid plans", () => {
    const { result } = renderHook(() => useAiQuizValidationLimit("pro"));

    expect(result.current.remaining).toBe(Number.POSITIVE_INFINITY);
    expect(result.current.canUse()).toBe(true);

    act(() => {
      result.current.consume();
    });

    expect(result.current.remaining).toBe(Number.POSITIVE_INFINITY);
  });
});
