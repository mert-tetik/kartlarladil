import { fireEvent, render } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { StreakCelebrationTest } from "./streak-celebration-test";

vi.mock("@/features/quiz/components/quiz-streak-celebration-view", () => ({
  QuizStreakCelebrationView: ({ streak, onComplete }: { streak: number; onComplete?: () => void }) => (
    <button type="button" data-streak-test-complete onClick={onComplete}>
      {streak}
    </button>
  ),
}));

describe("StreakCelebrationTest", () => {
  it("loops through five-step streaks and starts over after fifty", () => {
    render(<StreakCelebrationTest />);

    const expectedStreaks = [5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 5];
    expect(document.querySelector("[data-streak-test]")?.getAttribute("data-streak-test-value")).toBe("5");

    for (const expectedStreak of expectedStreaks.slice(1)) {
      fireEvent.click(document.querySelector("[data-streak-test-complete]") as HTMLElement);
      expect(document.querySelector("[data-streak-test]")?.getAttribute("data-streak-test-value")).toBe(
        String(expectedStreak),
      );
    }
  });
});
