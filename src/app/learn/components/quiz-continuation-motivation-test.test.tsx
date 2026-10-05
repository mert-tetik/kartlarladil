import { fireEvent, render } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import {
  createQuizContinuationMotivationTestInput,
  QuizContinuationMotivationTest,
} from "./quiz-continuation-motivation-test";

vi.mock("@/features/quiz/components/quiz-continuation-motivation-view", () => ({
  QuizContinuationMotivationView: (props: {
    input: { answeredCount: number; incorrectCount: number; remainingActiveCards: number };
    hasMoreCardsToLearn: boolean;
    isReviewQuiz?: boolean;
    prioritizeNextRank?: boolean;
    onContinue: () => void;
    onMotivationsResolved?: (motivations: []) => void;
  }) => {
    props.onMotivationsResolved?.([]);
    return (
      <button
        type="button"
        data-quiz-continuation-motivation-view
        data-answered-count={props.input.answeredCount}
        data-incorrect-count={props.input.incorrectCount}
        data-remaining-active-cards={props.input.remainingActiveCards}
        data-has-more-cards={String(props.hasMoreCardsToLearn)}
        data-review-quiz={String(Boolean(props.isReviewQuiz))}
        data-prioritize-next-rank={String(Boolean(props.prioritizeNextRank))}
        onClick={props.onContinue}
      />
    );
  },
}));

describe("QuizContinuationMotivationTest", () => {
  it("generates coherent randomized quiz values", () => {
    for (let index = 0; index < 20; index += 1) {
      const input = createQuizContinuationMotivationTestInput();
      expect(input.answeredCount).toBeGreaterThanOrEqual(6);
      expect(input.incorrectCount).toBeGreaterThanOrEqual(0);
      expect(input.incorrectCount).toBeLessThanOrEqual(input.answeredCount);
      expect(input.accuracy).toBe(
        Math.round(
          ((input.answeredCount - input.incorrectCount) / input.answeredCount) * 100,
        ),
      );
      if (input.chestWasMissed) {
        expect(input.chestMissedByPercentagePoints).toBeGreaterThan(0);
      } else {
        expect(input.chestMissedByPercentagePoints).toBe(0);
      }
    }
  });

  it("renders the isolated test screen and logs its simulation", () => {
    const consoleInfo = vi.spyOn(console, "info").mockImplementation(() => undefined);

    try {
      const { container } = render(<QuizContinuationMotivationTest />);

      expect(container.querySelector("[data-quiz-continuation-motivation-test]")).toBeInTheDocument();
      expect(consoleInfo).toHaveBeenCalledWith(
        "[quiz-continuation-test] Simulated quiz values",
        expect.objectContaining({ answeredCount: expect.any(Number) }),
      );
    } finally {
      consoleInfo.mockRestore();
    }
  });

  it("alternates between normal and learned-review simulations", () => {
    const { container } = render(<QuizContinuationMotivationTest />);
    const screen = container.querySelector("[data-quiz-continuation-motivation-test]")!;
    const view = container.querySelector("[data-quiz-continuation-motivation-view]")!;

    expect(screen).toHaveAttribute("data-review-quiz", "false");
    expect(view).toHaveAttribute("data-review-quiz", "false");
    expect(view).toHaveAttribute("data-prioritize-next-rank", "true");

    fireEvent.click(view);
    expect(screen).toHaveAttribute("data-review-quiz", "true");
    expect(view).toHaveAttribute("data-review-quiz", "true");
    expect(view).toHaveAttribute("data-prioritize-next-rank", "false");

    fireEvent.click(view);
    expect(screen).toHaveAttribute("data-review-quiz", "false");
    expect(view).toHaveAttribute("data-review-quiz", "false");
  });
});
