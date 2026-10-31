import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { BonusQuestionsTest } from "./bonus-questions-test";

vi.mock("@/i18n/locale-provider", () => ({
  useLocale: () => ({ locale: "en" }),
}));

vi.mock("@/features/progress/progress-client", () => ({
  useProgressStats: () => ({ stats: { totalPoints: 100 } }),
}));

vi.mock("@/features/quiz/components/bonus-question-view", () => ({
  BonusQuestionView: ({ question, onSkip, scorePulse = 0, gemBalances, onPointArrive, onGemArrive }: {
    question: { kind: string };
    onSkip: () => void;
    scorePulse?: number;
    gemBalances?: { blue: number; green: number; purple: number } | null;
    onPointArrive?: (amount: number) => void;
    onGemArrive?: (type: "blue" | "green" | "purple", amount: number) => void;
  }) => (
    <div
      data-testid="bonus-test-question"
      data-kind={question.kind}
      data-score-pulse={scorePulse}
      data-blue-gems={gemBalances?.blue ?? 0}
    >
      <button type="button" onClick={onSkip}>skip</button>
      <button type="button" onClick={() => onPointArrive?.(7)}>arrive points</button>
      <button type="button" onClick={() => onGemArrive?.("blue", 3)}>arrive gems</button>
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

    expect(screen.getByTestId("bonus-test-question")).toHaveAttribute("data-kind", "matching");

    fireEvent.click(screen.getByRole("button", { name: "skip" }));
    fireEvent.click(screen.getByRole("button", { name: "next" }));
    expect(screen.getByTestId("bonus-test-question")).toHaveAttribute("data-kind", "sentence-order");

    fireEvent.click(screen.getByRole("button", { name: "skip" }));
    fireEvent.click(screen.getByRole("button", { name: "next" }));
    expect(screen.getByTestId("bonus-test-question")).toHaveAttribute("data-kind", "category-sort");

    fireEvent.click(screen.getByRole("button", { name: "skip" }));
    fireEvent.click(screen.getByRole("button", { name: "next" }));
    expect(screen.getByTestId("bonus-test-question")).toHaveAttribute("data-kind", "imposter");
  });

  it("increments the simulated point pulse and the exact arrived gem amount", () => {
    render(<BonusQuestionsTest onlyMatching />);

    fireEvent.click(screen.getByRole("button", { name: "arrive points" }));
    fireEvent.click(screen.getByRole("button", { name: "arrive gems" }));

    expect(screen.getByTestId("bonus-test-question")).toHaveAttribute("data-score-pulse", "1");
    expect(screen.getByTestId("bonus-test-question")).toHaveAttribute("data-blue-gems", "3");
  });
});
