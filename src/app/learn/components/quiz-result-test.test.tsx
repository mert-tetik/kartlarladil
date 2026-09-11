import { render } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { QuizResultTest } from "./quiz-result-test";

vi.mock("@/features/quiz/components/quiz-station", () => ({
  ResultView: (props: {
    mode: string;
    results: { correct: unknown[]; incorrect: unknown[]; learned: unknown[] };
    selectedCount: number;
    chestOpened: boolean;
  }) => (
    <div
      data-result-test-view
      data-mode={props.mode}
      data-correct-count={props.results.correct.length}
      data-incorrect-count={props.results.incorrect.length}
      data-learned-count={props.results.learned.length}
      data-selected-count={props.selectedCount}
      data-chest-opened={String(props.chestOpened)}
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
  });
});
