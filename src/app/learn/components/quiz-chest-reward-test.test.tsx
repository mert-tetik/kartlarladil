import { act, fireEvent, render } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { QuizChestRewardTest } from "./quiz-chest-reward-test";

vi.mock("@/i18n/locale-provider", () => ({
  useLocale: () => ({ locale: "en" }),
  useT: () => (key: string, values?: Record<string, string>) =>
    values ? `${key}:${Object.values(values).join(",")}` : key,
}));

vi.mock("@/features/quiz/components/quiz-chest-reward-gate", () => ({
  QuizChestRewardGate: ({
    tier,
    onComplete,
  }: {
    tier: { tier: string } | null;
    onComplete: () => void;
  }) => (
    <button
      type="button"
      data-chest-gate-test
      data-chest-tier={tier?.tier ?? "missed"}
      onClick={onComplete}
    />
  ),
}));

describe("QuizChestRewardTest", () => {
  it("alternates between an iron chest and a missed chest", () => {
    vi.useFakeTimers();

    try {
      const { container } = render(<QuizChestRewardTest />);
      const root = container.querySelector("[data-quiz-chest-reward-test]")!;

      expect(root).toHaveAttribute("data-quiz-chest-reward-test-state", "earned");
      expect(container.querySelector("[data-chest-gate-test]")).not.toBeInTheDocument();

      act(() => {
        vi.advanceTimersByTime(1000);
      });

      expect(container.querySelector("[data-chest-gate-test]")).toHaveAttribute("data-chest-tier", "iron");

      fireEvent.click(container.querySelector("[data-chest-gate-test]")!);

      expect(root).toHaveAttribute("data-quiz-chest-reward-test-round", "1");
      expect(root).toHaveAttribute("data-quiz-chest-reward-test-state", "missed");
      expect(container.querySelector("[data-chest-gate-test]")).not.toBeInTheDocument();

      act(() => {
        vi.advanceTimersByTime(1000);
      });

      expect(container.querySelector("[data-chest-gate-test]")).toHaveAttribute("data-chest-tier", "missed");
    } finally {
      vi.useRealTimers();
    }
  });
});
