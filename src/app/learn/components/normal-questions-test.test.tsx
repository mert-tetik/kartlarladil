import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { NormalQuestionsTest } from "./normal-questions-test";

vi.mock("@/i18n/locale-provider", () => ({
  useLocale: () => ({ locale: "en" }),
  useT: () => (key: string) => key,
}));

vi.mock("@/features/quiz/components/quiz-station", () => {
  const Question = ({
    item,
    onSkip,
    rerollAction,
  }: {
    item: { questionType: string };
    onSkip: () => void;
    rerollAction?: { disabled: boolean };
  }) => (
    <div data-testid="normal-test-question" data-kind={item.questionType}>
      <button type="button" onClick={onSkip}>skip</button>
      {rerollAction ? <button type="button" disabled={rerollAction.disabled}>reroll</button> : null}
    </div>
  );

  return {
    ChoiceQuestion: Question,
    DefinitionQuestion: Question,
    GroupQuestion: Question,
    ListeningQuestion: Question,
    SentenceCompletionQuestion: Question,
    TextQuestion: Question,
    TrueFalseQuestion: Question,
    MobileQuizTopBar: ({ currentIndex, total }: { currentIndex: number; total: number }) => (
      <div data-testid="normal-test-progress">{currentIndex + 1} / {total}</div>
    ),
    MobileQuizFeedback: ({ isOpen, onNext }: { isOpen: boolean; onNext: () => void }) =>
      isOpen ? <button type="button" onClick={onNext}>next</button> : null,
  };
});

vi.mock("@/features/cards/components/vocabulary-card-view", () => ({
  VocabularyCardView: () => <div data-testid="normal-test-card" />,
}));

describe("NormalQuestionsTest", () => {
  it("cycles through all normal question types without using inventory state", () => {
    render(<NormalQuestionsTest />);

    const expectedKinds = [
      "choice",
      "listening",
      "definition",
      "group",
      "true-false",
      "sentence-completion",
      "text",
    ];

    for (const kind of expectedKinds) {
      expect(screen.getByTestId("normal-test-question")).toHaveAttribute("data-kind", kind);
      expect(screen.getByTestId("normal-test-progress")).toHaveTextContent(
        `${expectedKinds.indexOf(kind) + 1} / ${expectedKinds.length}`,
      );
      expect(screen.getByRole("button", { name: "reroll" })).toBeDisabled();
      fireEvent.click(screen.getByRole("button", { name: "skip" }));
      fireEvent.click(screen.getByRole("button", { name: "next" }));
    }

    expect(screen.getByTestId("normal-test-question")).toHaveAttribute("data-kind", "choice");
  });
});
