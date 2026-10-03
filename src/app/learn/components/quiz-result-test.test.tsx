import { act, fireEvent, render } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { QuizResultTest } from "./quiz-result-test";

vi.mock("@/features/quiz/components/quiz-station", () => ({
  ResultFlowView: (props: {
      mode: string;
      results: { correct: unknown[]; incorrect: unknown[]; learned: unknown[] };
      selectedCount: number;
      chestOpened: boolean;
      showResultMessage: boolean;
      learnedCards: unknown[];
      advancedCards: unknown[];
      onRestart: () => void;
    }) => (
      <button
        type="button"
        data-result-test-view
        data-mode={props.mode}
        data-correct-count={props.results.correct.length}
        data-incorrect-count={props.results.incorrect.length}
        data-learned-count={props.results.learned.length}
        data-selected-count={props.selectedCount}
        data-chest-opened={String(props.chestOpened)}
        data-result-message={String(props.showResultMessage)}
        data-learned-cards={props.learnedCards.length}
        data-advanced-cards={props.advancedCards.length}
        onClick={props.onRestart}
      />
    ),
}));

describe("QuizResultTest", () => {
  it("renders a successful active quiz result without a quiz session", () => {
    render(<QuizResultTest />);

    expect(document.querySelector("[data-quiz-result-test]")).toBeInTheDocument();
    expect(document.querySelector("[data-result-test-view]")).toHaveAttribute("data-mode", "active");
    expect(document.querySelector("[data-result-test-view]")).toHaveAttribute("data-correct-count", "10");
    expect(document.querySelector("[data-result-test-view]")).toHaveAttribute("data-incorrect-count", "0");
    expect(document.querySelector("[data-result-test-view]")).toHaveAttribute("data-learned-count", "3");
    expect(document.querySelector("[data-result-test-view]")).toHaveAttribute("data-selected-count", "10");
    expect(document.querySelector("[data-result-test-view]")).toHaveAttribute("data-chest-opened", "true");
    expect(document.querySelector("[data-result-test-view]")).toHaveAttribute("data-result-message", "true");
    expect(document.querySelector("[data-result-test-view]")).toHaveAttribute("data-learned-cards", "14");
    expect(document.querySelector("[data-result-test-view]")).toHaveAttribute("data-advanced-cards", "14");
  });

  it("closes and reopens the result screen after one second from continue", () => {
    vi.useFakeTimers();

    try {
      render(<QuizResultTest />);
      fireEvent.click(document.querySelector("[data-result-test-view]")!);

      expect(document.querySelector("[data-result-test-view]")).not.toBeInTheDocument();
      expect(document.querySelector("[data-quiz-result-test]")).toHaveAttribute(
        "data-quiz-result-test-state",
        "closed",
      );

      act(() => {
        vi.advanceTimersByTime(1000);
      });

      expect(document.querySelector("[data-result-test-view]")).toBeInTheDocument();
      expect(document.querySelector("[data-quiz-result-test]")).toHaveAttribute(
        "data-quiz-result-test-round",
        "1",
      );
    } finally {
      vi.useRealTimers();
    }
  });
});
