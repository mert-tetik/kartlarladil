import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { NormalQuestionsTest } from "./normal-questions-test";

vi.mock("@/i18n/locale-provider", () => ({
  useLocale: () => ({ locale: "en" }),
}));

vi.mock("@/features/quiz/components/quiz-station", () => {
  const Question = ({ item, onSkip }: { item: { questionType: string }; onSkip: () => void }) => (
    <div data-testid="normal-test-question" data-kind={item.questionType}>
      <button type="button" onClick={onSkip}>skip</button>
    </div>
  );

  return {
    ChoiceQuestion: Question,
    DefinitionQuestion: Question,
    ListeningQuestion: Question,
    SentenceCompletionQuestion: Question,
    TextQuestion: Question,
    TrueFalseQuestion: Question,
    MobileQuizFeedback: ({ isOpen, onNext }: { isOpen: boolean; onNext: () => void }) =>
      isOpen ? <button type="button" onClick={onNext}>next</button> : null,
  };
});

describe("NormalQuestionsTest", () => {
  it("cycles through all normal question types without using inventory state", () => {
    render(<NormalQuestionsTest />);

    const expectedKinds = [
      "choice",
      "listening",
      "definition",
      "true-false",
      "sentence-completion",
      "text",
    ];

    for (const kind of expectedKinds) {
      expect(screen.getByTestId("normal-test-question")).toHaveAttribute("data-kind", kind);
      fireEvent.click(screen.getByRole("button", { name: "skip" }));
      fireEvent.click(screen.getByRole("button", { name: "next" }));
    }

    expect(screen.getByTestId("normal-test-question")).toHaveAttribute("data-kind", "choice");
  });
});
