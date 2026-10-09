import { fireEvent, render } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { QuizContinuationMotivationView } from "./quiz-continuation-motivation-view";

const routerPushMock = vi.hoisted(() => vi.fn());
const openLeaderboardMock = vi.hoisted(() => vi.fn());

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: routerPushMock }),
  useSearchParams: () => new URLSearchParams(),
}));

vi.mock("@/i18n/locale-provider", () => ({
  useLocale: () => ({ locale: "en" }),
  useT: () => (key: string, values?: Record<string, string | number>) =>
    values ? `${key}:${Object.values(values).join(",")}` : key,
}));

vi.mock("@/features/leaderboard/components/leaderboard-overlay-provider", () => ({
  useLeaderboardOverlay: () => ({ openLeaderboard: openLeaderboardMock }),
}));

vi.mock("@/features/leaderboard/use-leaderboard", () => ({
  useLeaderboardData: () => ({
    data: null,
    loading: false,
    error: "",
    refresh: vi.fn(),
  }),
}));

vi.mock("@/lib/route-transition", () => ({
  navigateWithRouteTransition: (callback: () => void) => callback(),
}));

const input = {
  nearLearnedCount: 2,
  nearLevelUpCount: 1,
  rankProgressPercent: 50,
  pointsToNextRank: 100,
  accuracy: 80,
  incorrectCount: 2,
  answeredCount: 10,
  remainingActiveCards: 8,
  gainedXp: 10,
  gainedGems: 0,
  earnedMedals: 3,
  chestWasMissed: false,
  chestMissedByPercentagePoints: 0,
};

describe("QuizContinuationMotivationView", () => {
  it("routes the new-card action back to the landing draw overlay", () => {
    routerPushMock.mockReset();

    const { container } = render(
      <QuizContinuationMotivationView
        input={{ ...input, remainingActiveCards: 0 }}
        hasMoreCardsToLearn={false}
        onContinue={vi.fn()}
        onExit={vi.fn()}
      />,
    );

    fireEvent.click(container.querySelector('[data-continuation-action="draw-cards"]')!);

    expect(routerPushMock).toHaveBeenCalledWith("/?mission-action=draw-cards");
  });

  it("renders three motivation cards with the legacy actions when cards remain", () => {
    const { container } = render(
      <QuizContinuationMotivationView
        input={input}
        hasMoreCardsToLearn
        onContinue={vi.fn()}
        onExit={vi.fn()}
      />,
    );

    expect(container.querySelectorAll("[data-quiz-continuation-motivation-card]")).toHaveLength(3);
    expect(container.querySelector("[data-quiz-continuation-motivation-list]")).toHaveClass(
      "quiz-continuation-stagger-enter",
    );
    expect(container.querySelector('[data-continuation-action="leaderboard"]')).toBeInTheDocument();
    expect(container.querySelector('[data-continuation-action="continue"]')).toBeInTheDocument();
    expect(container.querySelector('[data-continuation-action="menu"]')).toBeInTheDocument();
  });

  it("keeps the leaderboard card last and replaces its placeholder when data arrives", () => {
    const { container, rerender, getByText } = render(
      <QuizContinuationMotivationView
        input={input}
        hasMoreCardsToLearn
        onContinue={vi.fn()}
        onExit={vi.fn()}
      />,
    );

    const cards = container.querySelectorAll("[data-quiz-continuation-motivation-card]");
    expect(cards[cards.length - 1]).toHaveAttribute(
      "data-quiz-continuation-motivation-card",
      "leaderboard",
    );
    expect(getByText(/quiz\.continuation\.motivation\.leaderboardPlaceholder/)).toBeInTheDocument();

    rerender(
      <QuizContinuationMotivationView
        input={input}
        hasMoreCardsToLearn
        leaderboardData={{
          mode: "points",
          viewer: {
            userId: "user-1",
            position: 7,
            pointsPosition: 7,
            streakPosition: 3,
            medalsPosition: 5,
            displayName: "Fox",
            totalPoints: 420,
            streak: 0,
            medals: 12,
            leaderboardVisible: true,
          },
          entries: [],
          canViewLeaderboard: true,
        }}
        onContinue={vi.fn()}
        onExit={vi.fn()}
      />,
    );

    expect(getByText("quiz.continuation.motivation.leaderboard:420,7")).toBeInTheDocument();
    expect(
      container.querySelector('[data-quiz-continuation-motivation-card="leaderboard"] img'),
    ).toHaveClass("scale-75");

    rerender(
      <QuizContinuationMotivationView
        input={input}
        hasMoreCardsToLearn
        leaderboardData={{
          mode: "points",
          viewer: {
            userId: "user-1",
            position: 1,
            pointsPosition: 1,
            streakPosition: 3,
            medalsPosition: 5,
            displayName: "Fox",
            totalPoints: 900,
            streak: 0,
            medals: 12,
            leaderboardVisible: true,
          },
          entries: [],
          canViewLeaderboard: true,
        }}
        onContinue={vi.fn()}
        onExit={vi.fn()}
      />,
    );

    expect(getByText(/quiz\.continuation\.motivation\.leaderboardFirst/)).toBeInTheDocument();
  });

  it("replaces the legacy actions and keeps the draw-card reason available", () => {
    const { container } = render(
      <QuizContinuationMotivationView
        input={{ ...input, remainingActiveCards: 0 }}
        hasMoreCardsToLearn={false}
        onContinue={vi.fn()}
        onExit={vi.fn()}
      />,
    );

    const cards = container.querySelectorAll("[data-quiz-continuation-motivation-card]");
    expect(cards[cards.length - 1]).toHaveAttribute(
      "data-quiz-continuation-motivation-card",
      "leaderboard",
    );
    expect(container.querySelector('[data-quiz-continuation-motivation-card="drawCards"]')).toBeInTheDocument();
    expect(container.querySelector('[data-continuation-action="draw-cards"]')).toBeInTheDocument();
    expect(container.querySelector('[data-continuation-action="continue"]')).not.toBeInTheDocument();
  });

  it("shows each leaderboard position and opens the matching mode", () => {
    openLeaderboardMock.mockReset();

    const { container } = render(
      <QuizContinuationMotivationView
        input={input}
        hasMoreCardsToLearn
        leaderboardData={{
          mode: "points",
          viewer: {
            userId: "user-1",
            position: 7,
            pointsPosition: 7,
            streakPosition: 3,
            medalsPosition: 5,
            displayName: "Fox",
            totalPoints: 420,
            streak: 8,
            medals: 12,
            leaderboardVisible: true,
          },
          entries: [],
          canViewLeaderboard: true,
        }}
        onContinue={vi.fn()}
        onExit={vi.fn()}
      />,
    );

    expect(container.querySelector('[data-leaderboard-motivation-display="points"]'))
      .toHaveTextContent("7.");
    expect(container.querySelector('[data-leaderboard-motivation-display="streaks"]'))
      .toHaveTextContent("3.");
    expect(container.querySelector('[data-leaderboard-motivation-display="medals"]'))
      .toHaveTextContent("5.");

    fireEvent.click(container.querySelector('[data-leaderboard-motivation-display="streaks"]')!);
    fireEvent.click(container.querySelector('[data-leaderboard-motivation-display="medals"]')!);

    expect(openLeaderboardMock).toHaveBeenNthCalledWith(1, "streaks");
    expect(openLeaderboardMock).toHaveBeenNthCalledWith(2, "medals");
  });

  it("uses the review character, title, motivations, and replay action for learned quizzes", () => {
    const { container, getByText } = render(
      <QuizContinuationMotivationView
        input={input}
        hasMoreCardsToLearn={false}
        isReviewQuiz
        onContinue={vi.fn()}
        onExit={vi.fn()}
      />,
    );

    expect(container.querySelector('[data-review-quiz="true"]')).toBeInTheDocument();
    expect(container.querySelector('[data-continuation-action="review-replay"]')).toBeInTheDocument();
    expect(container.querySelector('[data-continuation-action="draw-cards"]')).not.toBeInTheDocument();
    expect(getByText("quiz.continuation.reviewTitle")).toBeInTheDocument();
    expect(container.querySelectorAll("img").length).toBeGreaterThan(0);
    expect(container.querySelectorAll("h3")).toHaveLength(0);
  });
});
