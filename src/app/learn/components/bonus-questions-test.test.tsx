import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { BonusQuestionsTest } from "./bonus-questions-test";

vi.mock("@/i18n/locale-provider", () => ({
  useLocale: () => ({ locale: "en" }),
}));

vi.mock("@/features/quiz/components/bonus-question-view", () => ({
  BonusQuestionIntro: ({ onComplete }: { onComplete: () => void }) => (
    <button type="button" data-testid="bonus-test-intro" onClick={onComplete}>
      intro
    </button>
  ),
  BonusQuestionView: ({ question, onSkip }: { question: { kind: string }; onSkip: () => void }) => (
    <div data-testid="bonus-test-question" data-kind={question.kind}>
      <button type="button" onClick={onSkip}>skip</button>
    </div>
  ),
}));

vi.mock("@/features/quiz/components/quiz-station", () => ({
  MobileQuizFeedback: ({ isOpen, onNext }: { isOpen: boolean; onNext: () => void }) =>
    isOpen ? <button type="button" onClick={onNext}>next</button> : null,
}));

describe("BonusQuestionsTest", () => {
  it("shows the four production bonus question kinds in sequence", () => {
    render(<BonusQuestionsTest />);

    fireEvent.click(screen.getByTestId("bonus-test-intro"));
    expect(screen.getByTestId("bonus-test-question")).toHaveAttribute("data-kind", "matching");

    fireEvent.click(screen.getByRole("button", { name: "skip" }));
    fireEvent.click(screen.getByRole("button", { name: "next" }));
    fireEvent.click(screen.getByTestId("bonus-test-intro"));
    expect(screen.getByTestId("bonus-test-question")).toHaveAttribute("data-kind", "sentence-order");

    fireEvent.click(screen.getByRole("button", { name: "skip" }));
    fireEvent.click(screen.getByRole("button", { name: "next" }));
    fireEvent.click(screen.getByTestId("bonus-test-intro"));
    expect(screen.getByTestId("bonus-test-question")).toHaveAttribute("data-kind", "category-sort");

    fireEvent.click(screen.getByRole("button", { name: "skip" }));
    fireEvent.click(screen.getByRole("button", { name: "next" }));
    fireEvent.click(screen.getByTestId("bonus-test-intro"));
    expect(screen.getByTestId("bonus-test-question")).toHaveAttribute("data-kind", "imposter");
  });
});
