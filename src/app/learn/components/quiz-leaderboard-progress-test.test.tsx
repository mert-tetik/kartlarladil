import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { LeaderboardPayload } from "@/features/leaderboard/leaderboard-types";
import { QuizLeaderboardProgressTest } from "@/app/learn/components/quiz-leaderboard-progress-test";

vi.mock("@/features/quiz/components/quiz-leaderboard-progress-view", () => ({
  QuizLeaderboardProgressView: ({
    payload,
    beforePosition,
    previousViewerPoints,
    onComplete,
  }: {
    payload: LeaderboardPayload | null;
    beforePosition: number | null;
    previousViewerPoints: number;
    onComplete: () => void;
  }) => (
    <section
      data-testid="leaderboard-cycle"
      data-current-position={payload?.viewer.pointsPosition}
      data-before-position={beforePosition}
      data-previous-viewer-points={previousViewerPoints}
    >
      <button type="button" onClick={onComplete}>Finish cycle</button>
    </section>
  ),
}));

afterEach(() => {
  vi.restoreAllMocks();
});

describe("QuizLeaderboardProgressTest", () => {
  it("replays with a fresh random scenario that always improves the viewer rank", () => {
    vi.spyOn(Math, "random").mockReturnValue(0.5);

    render(<QuizLeaderboardProgressTest />);

    const loop = screen.getByRole("main", { hidden: true });
    const firstCycle = screen.getByTestId("leaderboard-cycle");
    expect(firstCycle.dataset.currentPosition).toBe("50");
    expect(firstCycle.dataset.beforePosition).toBe("76");
    expect(firstCycle.dataset.previousViewerPoints).toBe("19999");
    expect(Number(firstCycle.dataset.currentPosition)).toBeLessThan(Number(firstCycle.dataset.beforePosition));

    fireEvent.click(screen.getByRole("button", { name: "Finish cycle" }));

    const nextCycle = screen.getByTestId("leaderboard-cycle");
    expect(loop).toHaveAttribute("data-loop-cycle", "1");
    expect(nextCycle.dataset.currentPosition).toBe("51");
    expect(nextCycle.dataset.beforePosition).toBe("76");
    expect(Number(nextCycle.dataset.currentPosition)).toBeLessThan(Number(nextCycle.dataset.beforePosition));

    fireEvent.click(screen.getByRole("button", { name: "Finish cycle" }));

    const thirdCycle = screen.getByTestId("leaderboard-cycle");
    expect(loop).toHaveAttribute("data-loop-cycle", "2");
    expect(thirdCycle.dataset.currentPosition).toBe("50");
    expect(thirdCycle.dataset.currentPosition).not.toBe(nextCycle.dataset.currentPosition);
  });
});
