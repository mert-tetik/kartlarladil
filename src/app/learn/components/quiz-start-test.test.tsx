import { fireEvent, render } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { QuizStartTest } from "./quiz-start-test";

vi.mock("@/features/quiz/components/quiz-start-splash", () => ({
  QuizStartSplash: ({ onComplete }: { onComplete: () => void }) => (
    <button type="button" data-quiz-start-complete onClick={onComplete}>
      START
    </button>
  ),
}));

describe("QuizStartTest", () => {
  it("restarts the quiz start splash after it completes", () => {
    const { container } = render(<QuizStartTest />);

    expect(container.querySelector("[data-quiz-start-test]")).toHaveAttribute(
      "data-quiz-start-test-round",
      "0",
    );

    fireEvent.click(container.querySelector("[data-quiz-start-complete]") as HTMLButtonElement);

    expect(container.querySelector("[data-quiz-start-test]")).toHaveAttribute(
      "data-quiz-start-test-round",
      "1",
    );
  });
});
