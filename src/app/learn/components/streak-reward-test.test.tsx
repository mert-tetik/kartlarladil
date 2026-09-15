import { fireEvent, render } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { StreakRewardTest } from "./streak-reward-test";

vi.mock("@/features/quiz/components/quiz-streak-reward-view", () => ({
  QuizStreakRewardView: ({
    streak,
    points,
    onComplete,
  }: {
    streak: number;
    points: number;
    onComplete: () => void;
  }) => (
    <button type="button" data-streak-reward-complete onClick={onComplete}>
      {streak}:{points}
    </button>
  ),
}));

describe("StreakRewardTest", () => {
  it("cycles through the reward streak values", () => {
    const { container } = render(<StreakRewardTest />);

    expect(container.querySelector("[data-streak-reward-test]")?.getAttribute("data-streak-reward-test-value")).toBe("5");
    expect(container.querySelector("[data-streak-reward-test]")?.getAttribute("data-streak-reward-test-points")).toBe("20");

    fireEvent.click(container.querySelector("[data-streak-reward-complete]") as HTMLElement);

    expect(container.querySelector("[data-streak-reward-test]")?.getAttribute("data-streak-reward-test-value")).toBe("10");
    expect(container.querySelector("[data-streak-reward-test]")?.getAttribute("data-streak-reward-test-points")).toBe("40");
  });
});
